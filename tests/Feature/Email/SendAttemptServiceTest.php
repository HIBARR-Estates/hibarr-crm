<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Enums\SendRecipientKind;
use App\Email\Enums\SendRecipientStatus;
use App\Email\Exceptions\EmailUnavailableException;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Models\EmailSendRecipient;
use App\Email\Sending\SendAttemptService;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SendAttemptServiceTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private SendAttemptService $service;

    private FakeMailAdapter $fake;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->service = app(SendAttemptService::class);
        $this->fake = app(FakeMailAdapter::class);
        $this->agent = $this->makeEmailUser();
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
    }

    public function test_tables_exist_with_the_domain_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('email_send_attempts', [
            'uuid', 'company_id', 'connection_id', 'draft_payload', 'status', 'provider_submission_id',
            'error_code', 'attempt_count', 'next_attempt_at', 'sent_at',
        ]));
        $this->assertTrue(Schema::hasColumns('email_send_recipients', [
            'company_id', 'send_attempt_id', 'address', 'kind', 'status',
        ]));
    }

    public function test_no_status_anywhere_is_called_delivered(): void
    {
        $values = array_merge(
            array_map(fn (SendAttemptStatus $s) => $s->value, SendAttemptStatus::cases()),
            array_map(fn (SendRecipientStatus $s) => $s->value, SendRecipientStatus::cases()),
        );

        $this->assertSame(
            ['sending', 'sent', 'failed', 'checking', 'waiting_quota'],
            array_map(fn (SendAttemptStatus $s) => $s->value, SendAttemptStatus::cases()),
        );
        $this->assertNotContains('delivered', $values);
    }

    public function test_provider_accept_marks_the_attempt_sent_not_delivered(): void
    {
        $attempt = $this->service->send($this->connection, $this->draft(), $this->agent)->fresh();

        $this->assertSame(SendAttemptStatus::Sent, $attempt->status);
        $this->assertSame('sent', $attempt->getRawOriginal('status'));
        $this->assertNotNull($attempt->provider_submission_id);
        $this->assertNotNull($attempt->sent_at);
        $this->assertNull($attempt->error_code);
        $this->assertSame(1, $attempt->attempt_count);
        $this->assertTrue(Str::isUuid($attempt->uuid));
        $this->assertSame((int) $this->agent->id, (int) $attempt->created_by);
        $this->assertSame((int) $this->connection->company_id, (int) $attempt->company_id);

        $recipients = $attempt->recipients()->withoutGlobalScopes()->orderBy('id')->get();

        $this->assertSame(['lead@example.test', 'partner@example.test'], $recipients->pluck('address')->all());
        $this->assertSame([SendRecipientKind::To, SendRecipientKind::Cc], $recipients->map(fn ($r) => $r->kind)->all());
        $this->assertSame(
            [SendRecipientStatus::Accepted, SendRecipientStatus::Accepted],
            $recipients->map(fn ($r) => $r->status)->all(),
        );
    }

    public function test_attempt_is_stored_with_a_crm_message_id_that_the_provider_receives(): void
    {
        $attempt = $this->service->send($this->connection, $this->draft())->fresh();

        $this->assertNotNull($attempt->rfc_message_id);
        $this->assertStringEndsWith('@agency.test>', $attempt->rfc_message_id);
        $this->assertSame($attempt->rfc_message_id, $attempt->draft()->rfcMessageId);
        $this->assertSame($attempt->rfc_message_id, $this->fake->sendCalls($this->connection->uuid)[0]->rfcMessageId);
        $this->assertSame('Hello', $attempt->draft()->textBody);
        $this->assertArrayNotHasKey('draft_payload', $attempt->toArray());

        $given = $this->service->send($this->connection, $this->draft('<given@crm.test>'))->fresh();

        $this->assertSame('<given@crm.test>', $given->rfc_message_id);
    }

    public function test_reject_fails_the_attempt_and_keeps_the_draft(): void
    {
        $this->fake->rejectNextSend($this->connection->uuid, 'invalid_recipient');

        $attempt = $this->service->send($this->connection, $this->draft())->fresh();

        $this->assertSame(SendAttemptStatus::Failed, $attempt->status);
        $this->assertSame('invalid_recipient', $attempt->error_code);
        $this->assertNull($attempt->sent_at);
        $this->assertNull($attempt->provider_submission_id);
        $this->assertSame('Villa viewing', $attempt->draft()->subject);
        $this->assertSame(
            [SendRecipientStatus::Pending],
            $attempt->recipients()->withoutGlobalScopes()->pluck('status')->unique()->values()->all(),
        );
    }

    public function test_throttle_waits_for_quota_and_a_retry_sends_the_same_attempt(): void
    {
        $this->fake->throttleNextSend($this->connection->uuid, 120);

        $attempt = $this->service->send($this->connection, $this->draft());

        $this->assertSame(SendAttemptStatus::WaitingQuota, $attempt->status);
        $this->assertNotNull($attempt->next_attempt_at);
        $this->assertTrue($attempt->next_attempt_at->isFuture());

        $retried = $this->service->retry($attempt);

        $this->assertSame($attempt->id, $retried->id);
        $this->assertSame(SendAttemptStatus::Sent, $retried->fresh()->status);
        $this->assertNull($retried->fresh()->next_attempt_at);
        $this->assertNull($retried->fresh()->error_code);
        $this->assertSame(2, $retried->fresh()->attempt_count);
        $this->assertSame(1, EmailSendAttempt::withoutGlobalScopes()->count());
    }

    public function test_unknown_outcome_is_checking_and_reconciling_never_creates_a_second_attempt(): void
    {
        // The provider took the message, but the CRM never saw the answer.
        $this->fake->timeoutNextSend($this->connection->uuid, providerTookIt: true);

        $attempt = $this->service->send($this->connection, $this->draft());

        $this->assertSame(SendAttemptStatus::Checking, $attempt->status);
        $this->assertSame('timeout', $attempt->error_code);
        $this->assertNull($attempt->sent_at);

        $first = $this->service->retry($attempt);

        $this->assertSame($attempt->id, $first->id);
        $this->assertSame(SendAttemptStatus::Sent, $first->status);
        $this->assertNotNull($first->provider_submission_id);

        $second = $this->service->retry($first->fresh());

        $this->assertSame($attempt->id, $second->id);
        $this->assertSame(SendAttemptStatus::Sent, $second->status);
        $this->assertSame(2, $second->fresh()->attempt_count);

        $this->assertSame(1, EmailSendAttempt::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailSendRecipient::withoutGlobalScopes()->count());
        // The provider holds exactly one message, and the second retry never reached it.
        $this->assertCount(1, $this->fake->messages($this->connection->uuid, FakeMailAdapter::FOLDER_SENT));
        $this->assertCount(2, $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_unknown_outcome_where_the_provider_never_got_it_sends_once_on_retry(): void
    {
        $this->fake->timeoutNextSend($this->connection->uuid);

        $attempt = $this->service->send($this->connection, $this->draft());
        $retried = $this->service->retry($attempt);

        $this->assertSame(SendAttemptStatus::Sent, $retried->status);
        $this->assertSame(1, EmailSendAttempt::withoutGlobalScopes()->count());
        $this->assertCount(1, $this->fake->messages($this->connection->uuid, FakeMailAdapter::FOLDER_SENT));
    }

    public function test_every_retry_resubmits_the_same_message_id(): void
    {
        $this->fake->rejectNextSend($this->connection->uuid)->throttleNextSend($this->connection->uuid);

        $attempt = $this->service->send($this->connection, $this->draft());
        $this->service->retry($attempt);
        $this->service->retry($attempt->fresh());

        $ids = array_map(fn (Draft $draft) => $draft->rfcMessageId, $this->fake->sendCalls($this->connection->uuid));

        $this->assertCount(3, $ids);
        $this->assertCount(1, array_unique($ids));
        $this->assertSame(SendAttemptStatus::Sent, $attempt->fresh()->status);
        $this->assertSame(3, $attempt->fresh()->attempt_count);
    }

    public function test_stale_model_cannot_resubmit_an_attempt_that_already_went_through(): void
    {
        $this->fake->rejectNextSend($this->connection->uuid);

        $attempt = $this->service->send($this->connection, $this->draft());
        $stale = EmailSendAttempt::withoutGlobalScopes()->find($attempt->id);

        $this->service->retry($attempt);
        $again = $this->service->retry($stale);

        $this->assertSame(SendAttemptStatus::Sent, $again->status);
        $this->assertSame(2, $again->attempt_count);
        $this->assertCount(2, $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_provider_without_an_adapter_fails_without_submitting(): void
    {
        $this->connection->update(['provider' => 'mailtrap']);

        $attempt = $this->service->send($this->connection, $this->draft());

        $this->assertSame(SendAttemptStatus::Failed, $attempt->status);
        $this->assertSame('provider_unavailable', $attempt->error_code);
        $this->assertSame([], $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_send_fails_closed_when_flag_is_off_user_is_not_allowlisted_or_mailbox_is_stopped(): void
    {
        $cases = [
            'feature_disabled' => fn () => $this->setFeatureFlag(EmailFeature::FLAG, false),
            'feature_disabled ' => fn () => EmailPilotAllowlistEntry::withoutGlobalScopes()->delete(),
            'connection_inactive' => fn () => $this->connection->update(['status' => ConnectionStatus::Stopped]),
        ];

        foreach ($cases as $reason => $arrange) {
            $arrange();

            try {
                $this->service->send($this->connection, $this->draft());
                $this->fail('Expected sending to be refused.');
            } catch (EmailUnavailableException $exception) {
                $this->assertSame(trim($reason), $exception->reason);
            }

            // Restore for the next case.
            $this->setFeatureFlag(EmailFeature::FLAG, true);
            EmailPilotAllowlistEntry::withoutGlobalScopes()->firstOrCreate([
                'company_id' => $this->agent->company_id,
                'user_id' => $this->agent->id,
            ]);
            $this->connection->update(['status' => ConnectionStatus::Active]);
        }

        $this->assertSame(0, EmailSendAttempt::withoutGlobalScopes()->count());
        $this->assertSame([], $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_retry_fails_closed_and_leaves_the_attempt_as_it_was(): void
    {
        $this->fake->rejectNextSend($this->connection->uuid, 'invalid_recipient');
        $attempt = $this->service->send($this->connection, $this->draft());

        $this->setFeatureFlag(EmailFeature::FLAG, false);

        try {
            $this->service->retry($attempt);
            $this->fail('Expected the retry to be refused.');
        } catch (EmailUnavailableException) {
            // refused
        }

        $this->assertSame(SendAttemptStatus::Failed, $attempt->fresh()->status);
        $this->assertSame(1, $attempt->fresh()->attempt_count);
        $this->assertCount(1, $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_attempts_are_isolated_to_the_logged_in_users_company(): void
    {
        $this->service->send($this->connection, $this->draft());

        $this->actingAs($this->makeEmailUser());

        $this->assertSame(0, EmailSendAttempt::query()->count());
        $this->assertSame(0, EmailSendRecipient::query()->count());
        $this->assertSame(1, EmailSendAttempt::withoutGlobalScopes()->count());
    }

    private function draft(?string $rfcMessageId = null): Draft
    {
        return new Draft(
            from: new EmailAddress('anna@agency.test', 'Anna'),
            to: ['Lead <lead@example.test>'],
            cc: ['partner@example.test', 'LEAD@example.test'],
            subject: 'Villa viewing',
            textBody: 'Hello',
            rfcMessageId: $rfcMessageId,
        );
    }
}
