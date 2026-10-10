<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\FollowableType;
use App\Email\FollowUps\FollowUpLinker;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFollowUp;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\Company;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class FollowUpLinkerTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private Company $company;

    private User $agent;

    private EmailConnection $mailbox;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading')->nullable();
            $table->timestamps();
        });

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->mailbox = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
        ]);
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
    }

    public function test_inbound_sync_does_not_create_a_task_by_default(): void
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Villa viewing',
            'text' => 'Can we see it Friday?',
            'rfc_message_id' => '<inbound-no-task@mail.test>',
        ]);

        $this->assertTrue(
            (new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded(),
        );

        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame(0, DB::table('tasks')->count());
        $this->assertSame(0, EmailFollowUp::withoutGlobalScopes()->count());
    }

    public function test_attach_stores_source_email_and_follow_up_opens_it(): void
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Follow up please',
            'text' => 'Need a task from this.',
            'rfc_message_id' => '<source-follow-up@mail.test>',
        ]);
        $this->assertTrue(
            (new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded(),
        );

        $message = EmailMessage::withoutGlobalScopes()->sole();
        $taskId = DB::table('tasks')->insertGetId([
            'company_id' => $this->company->id,
            'heading' => 'Call back',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $task = (new Task)->newFromBuilder([
            'id' => $taskId,
            'company_id' => $this->company->id,
            'heading' => 'Call back',
        ]);

        $linker = app(FollowUpLinker::class);
        $link = $linker->attach($this->agent, $task, $message->uuid);

        $this->assertSame(FollowableType::Task, $link->followable_type);
        $this->assertSame($taskId, (int) $link->followable_id);
        $this->assertSame($message->id, (int) $link->message_id);
        $this->assertSame($message->uuid, $linker->sourceUuidFor($task));

        $decorated = collect([$task]);
        $linker->decorateSourceUuids($decorated);
        $this->assertSame($message->uuid, $task->getAttribute('source_email_message_id'));
    }

    public function test_attach_rejects_message_outside_actor_access(): void
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Private',
            'text' => 'Only Anna sees this.',
            'rfc_message_id' => '<private-source@mail.test>',
        ]);
        $this->assertTrue(
            (new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded(),
        );

        $message = EmailMessage::withoutGlobalScopes()->sole();
        $outsider = $this->makeEmailUser($this->company);
        EmailPilotAllowlistEntry::factory()->forUser($outsider)->create();

        $taskId = DB::table('tasks')->insertGetId([
            'company_id' => $this->company->id,
            'heading' => 'Should fail',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $task = (new Task)->newFromBuilder(['id' => $taskId, 'company_id' => $this->company->id]);

        $this->expectException(\DomainException::class);
        $this->expectExceptionMessage('source_email_unavailable');

        app(FollowUpLinker::class)->attach($outsider, $task, $message->uuid);
    }
}
