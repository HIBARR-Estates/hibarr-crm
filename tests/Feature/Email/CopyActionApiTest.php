<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\RecordFeed;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailRecordLink;
use App\Email\Transport\MailTransportFactory;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Mockery\MockInterface;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class CopyActionApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->grant($this->agent, ['view_lead' => 'owned', 'view_deals' => 'added']);
    }

    public function test_link_then_unlink_empties_the_record_feed_and_keeps_the_copy(): void
    {
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->agent->id]);
        $copy = $this->ingest($this->connection, 'stranger@example.test');
        $this->signIn($this->agent);

        $this->postJson("/email/copies/{$copy->uuid}/link", ['record_type' => 'lead', 'record_id' => $lead->id])
            ->assertOk()
            ->assertExactJson(['copy' => ['id' => $copy->uuid, 'review_status' => 'none', 'linked' => true]]);

        $this->assertSame([$copy->message_id], $this->feed($lead));
        $this->assertSame([], array_column($this->getJson('/email/review')->json('items'), 'id'));

        $this->postJson("/email/copies/{$copy->uuid}/unlink", ['record_type' => 'lead', 'record_id' => $lead->id])
            ->assertOk()
            ->assertExactJson(['copy' => ['id' => $copy->uuid, 'review_status' => 'unlinked', 'linked' => false]]);

        // Projection gone; the mail itself is untouched and back in its owner's review.
        $this->assertSame([], $this->feed($lead));
        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertNotNull($copy->fresh());
        $this->assertNotNull(EmailMessage::withoutGlobalScopes()->find($copy->message_id));
        $this->assertSame([$copy->uuid], array_column($this->getJson('/email/review')->json('items'), 'id'));

        $audits = EmailLinkAudit::withoutGlobalScopes()->orderBy('id')->get();

        $this->assertSame([LinkAuditAction::Link, LinkAuditAction::Unlink], $audits->map(fn ($a) => $a->action)->all());
        $this->assertSame([(int) $this->agent->id], $audits->pluck('actor_id')->map(fn ($id) => (int) $id)->unique()->values()->all());

        // Unlinking again changes nothing and audits nothing.
        $this->postJson("/email/copies/{$copy->uuid}/unlink", ['record_type' => 'lead', 'record_id' => $lead->id])->assertOk();
        $this->assertSame(2, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_linking_a_thread_brings_that_mailboxs_earlier_messages_in_order_and_nobody_elses(): void
    {
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->agent->id]);
        $colleague = $this->makeEmailUser($this->company);
        $theirMailbox = EmailConnection::factory()->forUser($colleague)->create();

        // Arrives out of order: the reply is synced before the original.
        $second = $this->ingest($this->connection, 'stranger@example.test', '<b@mail.test>', '<a@mail.test>', '2026-10-02T09:00:00+00:00');
        $first = $this->ingest($this->connection, 'stranger@example.test', '<a@mail.test>', null, '2026-10-01T09:00:00+00:00');
        $third = $this->ingest($this->connection, 'stranger@example.test', '<c@mail.test>', '<b@mail.test>', '2026-10-03T09:00:00+00:00');
        // Same thread, but only ever in the colleague's mailbox.
        $private = $this->ingest($theirMailbox, 'stranger@example.test', '<d@mail.test>', '<a@mail.test>', '2026-10-02T12:00:00+00:00');

        $this->signIn($this->agent);

        $this->postJson("/email/copies/{$third->uuid}/link", ['record_type' => 'lead', 'record_id' => $lead->id])->assertOk();

        $this->assertSame([$first->message_id, $second->message_id, $third->message_id], $this->feed($lead));
        $this->assertSame(ReviewStatus::None, $first->fresh()->review_status);
        $this->assertSame(ReviewStatus::None, $second->fresh()->review_status);
        $this->assertSame(ReviewStatus::Unlinked, $private->fresh()->review_status);
        $this->assertSame(1, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_dismiss_does_not_call_the_adapter_and_keeps_the_copy(): void
    {
        $copy = $this->ingest($this->connection, 'spam@example.test');
        $linked = $this->ingest($this->connection, 'stranger@example.test');
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->agent->id]);
        $this->signIn($this->agent);
        $this->postJson("/email/copies/{$linked->uuid}/link", ['record_type' => 'lead', 'record_id' => $lead->id])->assertOk();

        // From here on, any use of a mail transport at all fails the test.
        $this->mock(MailTransportFactory::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('forConnection', 'make', 'default');
        });

        $this->postJson("/email/copies/{$copy->uuid}/dismiss")
            ->assertOk()
            ->assertExactJson(['copy' => ['id' => $copy->uuid, 'review_status' => 'dismissed', 'linked' => false]]);
        $this->postJson("/email/copies/{$copy->uuid}/dismiss")->assertOk();

        $this->assertSame(ReviewStatus::Dismissed, $copy->fresh()->review_status);
        $this->assertNotNull(EmailMessage::withoutGlobalScopes()->find($copy->message_id));
        $this->assertSame([], array_column($this->getJson('/email/review')->json('items'), 'id'));

        $audit = EmailLinkAudit::withoutGlobalScopes()->where('action', LinkAuditAction::Dismiss)->sole();

        $this->assertSame($copy->id, (int) $audit->mailbox_copy_id);
        $this->assertSame((int) $this->agent->id, (int) $audit->actor_id);

        // Mail already on a record is not in review, so there is nothing to dismiss.
        $this->postJson("/email/copies/{$linked->uuid}/dismiss")->assertStatus(409);
        $this->assertSame(ReviewStatus::None, $linked->fresh()->review_status);

        // A dismissed copy can still be put on a record afterwards.
        $this->postJson("/email/copies/{$copy->uuid}/link", ['record_type' => 'lead', 'record_id' => $lead->id])
            ->assertOk()
            ->assertJsonPath('copy.review_status', 'none');
    }

    public function test_another_users_copy_cannot_be_linked_unlinked_or_dismissed(): void
    {
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->agent->id]);
        $colleague = $this->makeEmailUser($this->company);
        $theirs = $this->ingest(EmailConnection::factory()->forUser($colleague)->create(), 'stranger@example.test');
        $this->signIn($this->agent);

        $record = ['record_type' => 'lead', 'record_id' => $lead->id];

        $this->postJson("/email/copies/{$theirs->uuid}/link", $record)->assertStatus(404);
        $this->postJson("/email/copies/{$theirs->uuid}/unlink", $record)->assertStatus(404);
        $this->postJson("/email/copies/{$theirs->uuid}/dismiss")->assertStatus(404);
        $this->postJson('/email/copies/'.Str::uuid().'/dismiss')->assertStatus(404);

        $this->assertSame(ReviewStatus::Unlinked, $theirs->fresh()->review_status);
        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(0, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_only_a_record_the_user_may_see_can_be_linked(): void
    {
        $colleague = $this->makeEmailUser($this->company);
        $hidden = $this->makeEmailLead($this->company, null, ['lead_owner' => $colleague->id]);
        $foreign = $this->makeEmailLead($this->makeEmailCompany());
        $deleted = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->agent->id, 'deleted_at' => now()]);
        $hiddenDeal = $this->makeEmailDeal($this->company, null, ['added_by' => $colleague->id]);
        $myDeal = $this->makeEmailDeal($this->company, null, ['added_by' => $this->agent->id]);

        $copy = $this->ingest($this->connection, 'stranger@example.test');
        $this->signIn($this->agent);

        foreach ([['lead', $hidden->id], ['lead', $foreign->id], ['lead', $deleted->id], ['lead', 999999], ['deal', $hiddenDeal->id]] as [$type, $id]) {
            $this->postJson("/email/copies/{$copy->uuid}/link", ['record_type' => $type, 'record_id' => $id])->assertStatus(404);
        }

        $this->postJson("/email/copies/{$copy->uuid}/link", ['record_type' => 'invoice', 'record_id' => 1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['record_type']);
        $this->postJson("/email/copies/{$copy->uuid}/link", [])->assertStatus(422);

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);

        $this->postJson("/email/copies/{$copy->uuid}/link", ['record_type' => 'deal', 'record_id' => $myDeal->id])
            ->assertOk()
            ->assertJsonPath('copy.linked', true);

        $this->assertSame([$copy->message_id], $this->feed($myDeal));
    }

    public function test_actions_sit_behind_the_flag_auth_and_the_pilot_allowlist(): void
    {
        $copy = $this->ingest($this->connection, 'stranger@example.test');
        $uris = ["/email/copies/{$copy->uuid}/link", "/email/copies/{$copy->uuid}/unlink", "/email/copies/{$copy->uuid}/dismiss"];

        foreach ($uris as $uri) {
            $this->postJson($uri)->assertStatus(401);
        }

        $this->signIn($this->makeEmailUser());

        foreach ($uris as $uri) {
            $this->postJson($uri)->assertStatus(403);
        }

        $this->signIn($this->agent);
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        foreach ($uris as $uri) {
            $this->postJson($uri)->assertStatus(404);
        }

        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    /**
     * @return list<int> Message ids on the record, in feed order.
     */
    private function feed(Model $record): array
    {
        return app(RecordFeed::class)->messages($record)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function ingest(
        EmailConnection $connection,
        string $from,
        ?string $rfcMessageId = null,
        ?string $inReplyTo = null,
        string $sentAt = '2026-10-01T09:30:00+00:00',
    ): EmailMailboxCopy {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            sentAt: new DateTimeImmutable($sentAt),
            subject: 'Hello',
            textBody: 'Plain text body.',
            rfcMessageId: $rfcMessageId ?? '<'.Str::random(12).'@mail.test>',
            inReplyTo: $inReplyTo,
            folder: 'INBOX',
        ));
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }

    /**
     * Stands in for the user's permission rows, which live in tables this schema does not build.
     *
     * @param  array<string, string>  $permissions
     */
    private function grant(User $user, array $permissions): void
    {
        $this->app->instance('user.permission-map.'.$user->id, $permissions);
    }
}
