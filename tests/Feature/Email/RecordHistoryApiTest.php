<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\ReviewStatus;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Linking\RecordFeed;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailRecordLink;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class RecordHistoryApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private Company $company;

    private User $anna;

    private User $ben;

    private EmailConnection $annasMailbox;

    private EmailConnection $bensMailbox;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        $this->anna = $this->makeEmailUser($this->company);
        $this->ben = $this->makeEmailUser($this->company);
        $this->annasMailbox = EmailConnection::factory()->forUser($this->anna)->create();
        $this->bensMailbox = EmailConnection::factory()->forUser($this->ben)->create();
        $this->lead = $this->makeEmailLead($this->company);

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();

        foreach ([$this->anna, $this->ben] as $user) {
            $this->app->instance('user.permission-map.'.$user->id, ['view_lead' => 'all']);
        }
    }

    public function test_one_email_in_two_mailboxes_is_one_event_on_the_record_with_a_copy_each(): void
    {
        [$annasCopy, $bensCopy] = $this->receiveInBothMailboxes();

        // One canonical message, two copies, both waiting in their own owner's review.
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame($annasCopy->message_id, $bensCopy->message_id);
        $this->assertNotSame($annasCopy->id, $bensCopy->id);

        $record = ['record_type' => 'lead', 'record_id' => $this->lead->id];

        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$annasCopy->uuid}/link", $record)->assertOk();

        // Anna's link does not speak for Ben's copy.
        $this->assertSame(ReviewStatus::Unlinked, $bensCopy->fresh()->review_status);

        $this->signIn($this->ben);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk()->assertJsonPath('meta.total', 0);
        $this->postJson("/email/copies/{$bensCopy->uuid}/link", $record)->assertOk();

        // Both linked to the one record: still one link, one message on the record.
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame([$annasCopy->message_id], app(RecordFeed::class)->messages($this->lead)->pluck('id')->all());
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());

        $bens = $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk();
        $this->signIn($this->anna);
        $annas = $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk();

        foreach ([[$annas, $annasCopy], [$bens, $bensCopy]] as [$response, $copy]) {
            $response->assertJsonPath('meta.total', 1)
                ->assertJsonCount(1, 'events')
                ->assertJsonPath('events.0.id', $copy->message->uuid)
                // Each user is pointed at their own copy of it.
                ->assertJsonPath('events.0.copy_id', $copy->uuid)
                ->assertJsonPath('events.0.subject', 'Villa viewing')
                ->assertJsonPath('events.0.sent_at', '2026-10-01T09:30:00+00:00')
                ->assertJsonPath('events.0.preview', 'Can we see it Friday?');
        }

        $this->assertSame($annas->json('events.0.id'), $bens->json('events.0.id'));
    }

    public function test_the_event_headers_show_every_to_and_cc_participant(): void
    {
        [$annasCopy, $bensCopy] = $this->receiveInBothMailboxes();
        $record = ['record_type' => 'lead', 'record_id' => $this->lead->id];

        $this->signIn($this->ben);
        $this->postJson("/email/copies/{$bensCopy->uuid}/link", $record)->assertOk();
        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$annasCopy->uuid}/link", $record)->assertOk();

        $event = $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk()->json('events.0');

        $this->assertSame(['address' => 'customer@example.test', 'name' => 'Customer Person'], $event['from']);
        $this->assertEqualsCanonicalizing(
            [$this->annasMailbox->identity_email, $this->bensMailbox->identity_email],
            array_column($event['to'], 'address'),
        );
        $this->assertSame(['partner@example.test'], array_column($event['cc'], 'address'));

        foreach (['text_body', 'html_raw', 'body', 'bcc', 'provider_message_id'] as $absent) {
            $this->assertArrayNotHasKey($absent, $event);
        }
    }

    public function test_history_is_limited_to_a_visible_record_and_the_viewers_own_copies(): void
    {
        [$annasCopy] = $this->receiveInBothMailboxes();
        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$annasCopy->uuid}/link", ['record_type' => 'lead', 'record_id' => $this->lead->id])->assertOk();

        // A colleague who can see the lead but holds no copy sees no mail on it yet (EmailAccess, E-20).
        $carol = $this->makeEmailUser($this->company);
        $this->app->instance('user.permission-map.'.$carol->id, ['view_lead' => 'all']);
        $this->signIn($carol);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk()->assertExactJson([
            'events' => [],
            'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 50, 'total' => 0],
        ]);

        // A user who may not see the lead cannot tell it from one that does not exist.
        $this->app->instance('user.permission-map.'.$carol->id, ['view_lead' => 'owned']);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertStatus(404);
        $this->getJson('/email/records/lead/999999/history')->assertStatus(404);
        $this->getJson("/email/records/invoice/{$this->lead->id}/history")->assertStatus(404);

        $this->signIn($this->anna);
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertStatus(404);
    }

    /**
     * The fixture: one email, same RFC Message-ID, delivered to both mailboxes and synced.
     *
     * @return array{0: EmailMailboxCopy, 1: EmailMailboxCopy} Anna's copy, Ben's copy.
     */
    private function receiveInBothMailboxes(): array
    {
        $this->fake->seedSameMessageOnConnections(
            [$this->annasMailbox->toContext(), $this->bensMailbox->toContext()],
            [
                'from' => 'Customer Person <customer@example.test>',
                'cc' => ['partner@example.test'],
                'subject' => 'Villa viewing',
                'text' => 'Can we see it Friday?',
                'sent_at' => '2026-10-01T09:30:00+00:00',
                'rfc_message_id' => '<shared@mail.example.test>',
            ],
        );

        foreach ([$this->annasMailbox, $this->bensMailbox] as $mailbox) {
            $this->assertTrue((new SyncMailboxJob($mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded());
        }

        return [
            EmailMailboxCopy::withoutGlobalScopes()->where('connection_id', $this->annasMailbox->id)->sole(),
            EmailMailboxCopy::withoutGlobalScopes()->where('connection_id', $this->bensMailbox->id)->sole(),
        ];
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
