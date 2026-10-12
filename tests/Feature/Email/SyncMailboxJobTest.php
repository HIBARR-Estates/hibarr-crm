<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Sync\MailboxSynchronizer;
use App\Email\Sync\SyncOutcome;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\FakesMailtrapInbox;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SyncMailboxJobTest extends TestCase
{
    use BuildsEmailSchema;
    use FakesMailtrapInbox;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->agent = $this->makeEmailUser();
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
    }

    public function test_job_goes_to_the_email_sync_queue(): void
    {
        Queue::fake();

        SyncMailboxJob::dispatch($this->connection->id);

        Queue::assertPushedOn('email-sync', SyncMailboxJob::class);
        $this->assertSame(1, (new SyncMailboxJob($this->connection->id))->tries);
    }

    public function test_job_ingests_the_fixture_and_persists_the_checkpoint(): void
    {
        $context = $this->connection->toContext();
        $inbound = $this->fake->seedInbound($context, ['from' => 'lead@example.test', 'subject' => 'Villa viewing']);
        $outbound = $this->fake->seedOutbound($context, ['subject' => 'Re: Villa viewing']);

        $outcome = $this->run_job();

        $this->assertTrue($outcome->succeeded());
        $this->assertSame(2, $outcome->ingested);

        $copies = EmailMailboxCopy::withoutGlobalScopes()->orderBy('id')->get();

        $this->assertSame(
            [$inbound->providerMessageId, $outbound->providerMessageId],
            $copies->pluck('provider_message_id')->all(),
        );
        $this->assertSame([$this->connection->id], $copies->pluck('connection_id')->unique()->values()->all());
        $this->assertSame('Villa viewing', $copies[0]->message->subject);
        $this->assertSame($inbound->rfcMessageId, $copies[0]->message->rfc_message_id);

        $connection = $this->connection->fresh();

        $this->assertNotNull($connection->last_sync_at);
        $this->assertNull($connection->last_error_code);
        $this->assertSame(ConnectionStatus::Active, $connection->status);
        $this->assertNotNull($connection->syncCheckpoint()->cursor(FakeMailAdapter::FOLDER_INBOX));
        $this->assertNotNull($connection->syncCheckpoint()->cursor(FakeMailAdapter::FOLDER_SENT));
    }

    public function test_running_again_ingests_only_what_is_new(): void
    {
        $context = $this->connection->toContext();
        $this->fake->seedInbound($context);

        $this->run_job();
        $second = $this->run_job();

        $this->assertTrue($second->succeeded());
        $this->assertSame(0, $second->ingested);
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());

        $this->fake->seedInbound($context);
        $third = $this->run_job();

        $this->assertSame(1, $third->ingested);
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_job_pages_through_a_backlog_in_one_run(): void
    {
        $this->fake->setPageSize(2);

        foreach (range(1, 5) as $n) {
            $this->fake->seedInbound($this->connection->toContext(), ['subject' => "Message {$n}"]);
        }

        $outcome = $this->run_job();

        $this->assertSame(5, $outcome->ingested);
        $this->assertSame(5, EmailMailboxCopy::withoutGlobalScopes()->count());
    }

    public function test_a_lost_checkpoint_does_not_duplicate_mail(): void
    {
        $this->fake->seedInbound($this->connection->toContext());

        $this->run_job();
        $this->connection->fresh()->update(['checkpoint' => null]);
        $outcome = $this->run_job();

        $this->assertSame(1, $outcome->ingested);
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_job_no_ops_when_the_flag_is_off(): void
    {
        $this->fake->seedInbound($this->connection->toContext());
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $outcome = $this->run_job();

        $this->assertFalse($outcome->ran);
        $this->assertSame('feature_disabled', $outcome->reason);
        $this->assertSame(0, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertNull($this->connection->fresh()->last_sync_at);
        $this->assertNull($this->connection->fresh()->checkpoint);
    }

    public function test_job_no_ops_when_the_owner_is_not_allowlisted(): void
    {
        $this->fake->seedInbound($this->connection->toContext());
        EmailPilotAllowlistEntry::withoutGlobalScopes()->delete();

        $outcome = $this->run_job();

        $this->assertFalse($outcome->ran);
        $this->assertSame('feature_disabled', $outcome->reason);
        $this->assertSame(0, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertNull($this->connection->fresh()->last_sync_at);
    }

    public function test_job_no_ops_for_a_stopped_or_broken_connection(): void
    {
        $this->fake->seedInbound($this->connection->toContext());

        foreach ([ConnectionStatus::Stopped, ConnectionStatus::NeedsReconnect, ConnectionStatus::Error] as $status) {
            $this->connection->update(['status' => $status]);

            $outcome = $this->run_job();

            $this->assertFalse($outcome->ran, $status->value);
            $this->assertSame('connection_inactive', $outcome->reason);
        }

        $this->assertSame(0, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertNull($this->connection->fresh()->last_sync_at);
    }

    public function test_job_no_ops_for_a_connection_that_no_longer_exists(): void
    {
        $outcome = (new SyncMailboxJob(999999))->handle(app(MailboxSynchronizer::class));

        $this->assertFalse($outcome->ran);
        $this->assertSame('connection_missing', $outcome->reason);
    }

    public function test_an_empty_inbox_syncs_cleanly(): void
    {
        $outcome = $this->run_job();

        $this->assertTrue($outcome->succeeded());
        $this->assertSame(0, $outcome->ingested);
        $this->assertNotNull($this->connection->fresh()->last_sync_at);
        $this->assertSame(ConnectionStatus::Active, $this->connection->fresh()->status);
    }

    public function test_a_temporary_provider_error_is_recorded_and_the_next_run_recovers(): void
    {
        $context = $this->connection->toContext();
        $this->fake->seedInbound($context);
        $this->run_job();
        $checkpoint = $this->connection->fresh()->checkpoint;

        $this->fake->seedInbound($context);
        $this->fake->failFetches($context, new MailTransportException('rate_limited', retryable: true));

        $failed = $this->run_job();

        $this->assertTrue($failed->ran);
        $this->assertFalse($failed->succeeded());
        $this->assertSame('rate_limited', $failed->reason);

        $connection = $this->connection->fresh();

        $this->assertSame('rate_limited', $connection->last_error_code);
        $this->assertSame(ConnectionStatus::Active, $connection->status);
        $this->assertSame($checkpoint, $connection->checkpoint);
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());

        $this->fake->failFetches($context, null);
        $recovered = $this->run_job();

        $this->assertTrue($recovered->succeeded());
        $this->assertSame(1, $recovered->ingested);
        $this->assertNull($this->connection->fresh()->last_error_code);
    }

    public function test_a_credential_problem_parks_the_connection_until_reconnect(): void
    {
        $this->fake->failFetches($this->connection->toContext(), new MailTransportException('unauthorized', retryable: false));

        $outcome = $this->run_job();

        $this->assertSame('unauthorized', $outcome->reason);
        $this->assertSame(ConnectionStatus::NeedsReconnect, $this->connection->fresh()->status);
        $this->assertSame('unauthorized', $this->connection->fresh()->last_error_code);

        // Parked: later runs do not keep hitting the provider.
        $this->assertSame('connection_inactive', $this->run_job()->reason);
    }

    public function test_a_provider_with_no_adapter_is_recorded_as_an_error_not_thrown(): void
    {
        $this->connection->update(['provider' => 'zoho']);

        $outcome = $this->run_job();

        $this->assertSame('provider_unavailable', $outcome->reason);
        $this->assertSame(ConnectionStatus::Error, $this->connection->fresh()->status);
    }

    public function test_one_failing_mailbox_does_not_affect_another(): void
    {
        $other = EmailConnection::factory()->forUser($this->agent)->create();
        $this->fake->failFetches($this->connection->toContext(), new MailTransportException('provider_error'));
        $this->fake->seedInbound($other->toContext());

        $this->run_job();
        $outcome = $this->run_job($other);

        $this->assertTrue($outcome->succeeded());
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->where('connection_id', $other->id)->count());
    }

    public function test_job_syncs_a_mailtrap_sandbox_message_into_one_local_copy(): void
    {
        $this->configureMailtrap();
        $this->putMailtrapMessage('501', 11, [
            'headers' => [
                'From' => 'Lead Person <lead@example.test>',
                'To' => $this->connection->identity_email,
                'Subject' => 'Sandbox hello',
                'Message-ID' => '<sandbox-11@mail.example.test>',
            ],
            'text' => 'Captured by the sandbox.',
        ]);
        $this->connection->update(['provider' => 'mailtrap', 'credentials' => ['sandbox' => 'a']]);

        $first = $this->run_job();
        $second = $this->run_job();

        $this->assertTrue($first->succeeded());
        $this->assertSame(1, $first->ingested);
        $this->assertSame(0, $second->ingested);

        $copy = EmailMailboxCopy::withoutGlobalScopes()->sole();

        $this->assertSame('11', $copy->provider_message_id);
        $this->assertSame('<sandbox-11@mail.example.test>', $copy->message->rfc_message_id);
        $this->assertSame('Sandbox hello', $copy->message->subject);
        $this->assertSame('Captured by the sandbox.', $copy->message->text_body);
        $this->assertSame(['INBOX' => '11'], $this->connection->fresh()->checkpoint);
    }

    public function test_a_mailtrap_inbox_that_is_gone_parks_the_connection_without_throwing(): void
    {
        $this->configureMailtrap();
        $this->connection->update(['provider' => 'mailtrap', 'credentials' => ['inbox_id' => '404404']]);

        $outcome = $this->run_job();

        $this->assertSame('inbox_not_found', $outcome->reason);
        $this->assertSame(ConnectionStatus::NeedsReconnect, $this->connection->fresh()->status);

        Http::assertSentCount(1);
    }

    private function run_job(?EmailConnection $connection = null): SyncOutcome
    {
        return (new SyncMailboxJob(($connection ?? $this->connection)->id))->handle(app(MailboxSynchronizer::class));
    }
}
