<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Support\RfcMessageId;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailTimelineGroupsApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private Company $company;

    private User $agent;

    private EmailConnection $mailbox;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->mailbox = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
        ]);
        $this->lead = $this->makeEmailLead($this->company);

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
        $this->app->instance('user.permission-map.'.$this->agent->id, ['view_lead' => 'all']);
    }

    public function test_one_group_per_conversation_with_dated_messages(): void
    {
        [$oldest, $newest] = $this->seedThreadedConversation();

        $this->signIn($this->agent);

        $response = $this->getJson("/email/records/lead/{$this->lead->id}/timeline")
            ->assertOk()
            ->assertJsonCount(1, 'groups');

        $response->assertJsonPath('groups.0.message_count', 2)
            ->assertJsonPath('groups.0.subject', 'Re: Villa viewing')
            ->assertJsonPath('groups.0.messages.0.sent_at', '2026-10-01T11:00:00+00:00')
            ->assertJsonPath('groups.0.messages.1.sent_at', '2026-10-01T09:00:00+00:00')
            ->assertJsonPath('groups.0.messages.0.subject', 'Re: Villa viewing')
            ->assertJsonPath('groups.0.messages.1.subject', 'Villa viewing');

        $this->assertSame(
            $response->json('groups.0.messages.0.id'),
            $response->json('groups.0.latest_message_id'),
        );
        $this->assertSame([$newest->uuid, $oldest->uuid], [
            $response->json('groups.0.messages.0.id'),
            $response->json('groups.0.messages.1.id'),
        ]);
        $this->assertSame($newest->conversation->uuid, $response->json('groups.0.id'));
    }

    public function test_two_conversations_are_two_groups(): void
    {
        $this->seedThreadedConversation();

        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Other <other@example.test>',
            'subject' => 'Separate thread',
            'text' => 'Hello',
            'rfc_message_id' => '<other@mail.example.test>',
            'sent_at' => '2026-10-03T12:00:00+00:00',
        ]);
        $this->sync();

        $extra = EmailMailboxCopy::withoutGlobalScopes()
            ->where('connection_id', $this->mailbox->id)
            ->orderByDesc('id')
            ->first();

        $this->signIn($this->agent);
        $this->postJson("/email/copies/{$extra->uuid}/link", [
            'record_type' => 'lead',
            'record_id' => $this->lead->id,
        ])->assertOk();

        $this->getJson("/email/records/lead/{$this->lead->id}/timeline")
            ->assertOk()
            ->assertJsonCount(2, 'groups')
            ->assertJsonPath('groups.0.subject', 'Separate thread')
            ->assertJsonPath('groups.0.message_count', 1)
            ->assertJsonPath('groups.1.message_count', 2);
    }

    public function test_failed_send_status_is_distinct_on_the_group(): void
    {
        [$oldest, $newest] = $this->seedThreadedConversation();

        $rfcId = RfcMessageId::normalize($newest->rfc_message_id) ?? $newest->rfc_message_id;

        EmailSendAttempt::withoutGlobalScopes()->create([
            'company_id' => $this->company->id,
            'connection_id' => $this->mailbox->id,
            'created_by' => $this->agent->id,
            'draft_payload' => [
                'from' => ['address' => 'anna@agency.test', 'name' => null],
                'to' => [['address' => 'customer@example.test', 'name' => null]],
                'cc' => [],
                'subject' => 'Re: Villa viewing',
                'text_body' => 'Friday works.',
                'html_body' => null,
                'attachments' => [],
                'rfc_message_id' => $rfcId,
                'in_reply_to' => null,
                'references' => [],
            ],
            'rfc_message_id' => $rfcId,
            'status' => SendAttemptStatus::Failed,
            'error_code' => 'smtp_rejected',
            'attempt_count' => 1,
        ]);

        $this->signIn($this->agent);

        $this->getJson("/email/records/lead/{$this->lead->id}/timeline")
            ->assertOk()
            ->assertJsonPath('groups.0.status', 'failed')
            ->assertJsonPath('groups.0.messages.0.send_status', 'failed')
            ->assertJsonPath('groups.0.messages.1.send_status', null);

        unset($oldest);
    }

    public function test_flag_off_returns_404(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->signIn($this->agent);

        $this->getJson("/email/records/lead/{$this->lead->id}/timeline")
            ->assertStatus(404);
    }

    /**
     * @return array{0: EmailMessage, 1: EmailMessage}
     */
    private function seedThreadedConversation(): array
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Villa viewing',
            'text' => 'Can we see it Friday?',
            'rfc_message_id' => '<root@mail.example.test>',
            'sent_at' => '2026-10-01T09:00:00+00:00',
        ]);
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Re: Villa viewing',
            'text' => 'Friday works.',
            'rfc_message_id' => '<reply@mail.example.test>',
            'in_reply_to' => '<root@mail.example.test>',
            'sent_at' => '2026-10-01T11:00:00+00:00',
        ]);
        $this->sync();

        $copies = EmailMailboxCopy::withoutGlobalScopes()
            ->where('connection_id', $this->mailbox->id)
            ->orderBy('id')
            ->get();

        $this->signIn($this->agent);
        foreach ($copies as $copy) {
            $this->postJson("/email/copies/{$copy->uuid}/link", [
                'record_type' => 'lead',
                'record_id' => $this->lead->id,
            ])->assertOk();
        }

        $messages = EmailMessage::withoutGlobalScopes()
            ->orderBy('sent_at')
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $messages);
        $this->assertSame($messages[0]->conversation_id, $messages[1]->conversation_id);

        return [$messages[0], $messages[1]];
    }

    private function sync(): void
    {
        $this->assertTrue(
            (new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded(),
        );
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');
        $this->actingAs($user);
    }
}
