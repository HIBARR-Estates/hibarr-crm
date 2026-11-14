<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SyncMailboxesCommandTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);
    }

    public function test_dispatches_one_job_per_active_mailbox(): void
    {
        Queue::fake();

        $company = $this->makeEmailCompany();
        $agent = $this->makeEmailUser($company);
        $other = $this->makeEmailUser($company);
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();

        $active = EmailConnection::factory()->forUser($agent)->create([
            'status' => ConnectionStatus::Active,
        ]);
        EmailConnection::factory()->forUser($other)->create([
            'status' => ConnectionStatus::Stopped,
        ]);
        EmailConnection::factory()->forUser($other)->create([
            'status' => ConnectionStatus::NeedsReconnect,
        ]);

        $this->assertSame(0, Artisan::call('email:sync-mailboxes'));

        Queue::assertPushed(SyncMailboxJob::class, 1);
        Queue::assertPushed(
            SyncMailboxJob::class,
            fn (SyncMailboxJob $job) => $job->connectionId === $active->id,
        );
        Queue::assertPushedOn(
            (string) config('email.queues.sync'),
            SyncMailboxJob::class,
        );
    }

    public function test_no_ops_when_the_flag_is_off(): void
    {
        Queue::fake();

        $agent = $this->makeEmailUser();
        EmailConnection::factory()->forUser($agent)->create();
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->assertSame(0, Artisan::call('email:sync-mailboxes'));

        Queue::assertNothingPushed();
    }
}
