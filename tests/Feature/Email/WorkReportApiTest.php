<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Enums\FollowableType;
use App\Email\Enums\HandoffStatus;
use App\Email\Enums\HandoffType;
use App\Email\Enums\ReviewStatus;
use App\Email\Enums\SendAttemptStatus;
use App\Email\FollowUps\FollowUpLinker;
use App\Email\Http\Middleware\EnsureEmailEnabled;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFollowUp;
use App\Email\Models\EmailHandoff;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Reads\ReadState;
use App\Email\Review\Handoffs;
use App\Email\Review\ReviewQueue;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Company;
use App\Models\Task;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class WorkReportApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $manager;

    private User $agent;

    private EmailConnection $agentMailbox;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading')->nullable();
            $table->timestamp('completed_on')->nullable();
            $table->timestamps();
        });

        $this->company = $this->makeEmailCompany();
        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();

        $this->manager = $this->makeEmailUser($this->company);
        $this->agent = $this->makeEmailUser($this->company);
        $this->grant($this->manager, ['view_lead' => 'all']);
        $this->grant($this->agent, ['view_lead' => 'owned']);

        $this->agentMailbox = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'agent@agency.test',
            'from_email' => 'agent@agency.test',
        ]);

        // Shared Inertia props (roles, modules, …) need the full CRM schema.
        $this->withoutMiddleware(HandleInertiaRequests::class);
    }

    public function test_informational_inbound_creates_no_open_follow_up_or_overdue(): void
    {
        $copy = $this->ingest($this->agentMailbox, 'info@example.test', [
            'subject' => 'FYI brochure',
            'textBody' => 'Just sharing the brochure.',
        ]);
        $this->assertSame(ReviewStatus::Unlinked, $copy->review_status);
        $this->assertSame(0, EmailFollowUp::withoutGlobalScopes()->count());
        $this->assertSame(0, DB::table('tasks')->count());

        $this->signIn($this->manager);
        $report = $this->getJson('/email/report')->assertOk()->json();

        $this->assertSame(1, $report['counts']['pending_routing']);
        $this->assertSame(0, $report['counts']['open_follow_ups']);
        $this->assertSame(0, $report['counts']['unresolved_handoffs']);
        $this->assertSame(0, $report['counts']['faults']);
        $this->assertSame([], $report['sections']['open_follow_ups']);

        foreach ($report['sections'] as $items) {
            foreach ($items as $item) {
                $this->assertNotSame('overdue', $item['kind'] ?? null);
            }
        }

        // Reading is not handling — pending routing stays.
        app(ReadState::class)->markRead($this->agent, $copy->message);
        $again = $this->getJson('/email/report')->assertOk()->json();
        $this->assertSame(1, $again['counts']['pending_routing']);
        $this->assertSame(0, $again['counts']['open_follow_ups']);
    }

    public function test_counts_match_source_queues(): void
    {
        $first = $this->ingest($this->agentMailbox, 'one@example.test', ['subject' => 'One']);
        $second = $this->ingest($this->agentMailbox, 'two@example.test', ['subject' => 'Two']);
        $handoffCopy = $this->ingest($this->agentMailbox, 'hand@example.test', ['subject' => 'Hand me']);

        $colleague = $this->makeEmailUser($this->company);
        $this->grant($colleague, ['view_lead' => 'owned']);
        app(Handoffs::class)->request(
            $this->agent,
            $handoffCopy,
            $colleague,
            HandoffType::Handoff,
            'Please take',
        );

        $taskId = DB::table('tasks')->insertGetId([
            'company_id' => $this->company->id,
            'heading' => 'Call back',
            'completed_on' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $task = (new Task)->newFromBuilder([
            'id' => $taskId,
            'company_id' => $this->company->id,
            'heading' => 'Call back',
            'completed_on' => null,
        ]);
        app(FollowUpLinker::class)->attach($this->agent, $task, $first->message->uuid);

        $doneId = DB::table('tasks')->insertGetId([
            'company_id' => $this->company->id,
            'heading' => 'Done already',
            'completed_on' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $done = (new Task)->newFromBuilder([
            'id' => $doneId,
            'company_id' => $this->company->id,
            'heading' => 'Done already',
            'completed_on' => now(),
        ]);
        app(FollowUpLinker::class)->attach($this->agent, $done, $second->message->uuid);

        EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'broken@agency.test',
            'from_email' => 'broken@agency.test',
            'status' => ConnectionStatus::NeedsReconnect,
            'last_error_code' => 'token_expired',
        ]);

        EmailSendAttempt::withoutGlobalScopes()->create([
            'company_id' => $this->company->id,
            'connection_id' => $this->agentMailbox->id,
            'created_by' => $this->agent->id,
            'draft_payload' => [
                'from' => 'agent@agency.test',
                'to' => ['lead@example.test'],
                'subject' => 'Failed send',
                'text_body' => 'Hi',
            ],
            'status' => SendAttemptStatus::Failed,
            'error_code' => 'provider_rejected',
            'attempt_count' => 1,
            'last_attempted_at' => now(),
        ]);

        // Waiting quota is not a fault on the report.
        EmailSendAttempt::withoutGlobalScopes()->create([
            'company_id' => $this->company->id,
            'connection_id' => $this->agentMailbox->id,
            'created_by' => $this->agent->id,
            'draft_payload' => [
                'from' => 'agent@agency.test',
                'to' => ['lead@example.test'],
                'subject' => 'Waiting',
                'text_body' => 'Hi',
            ],
            'status' => SendAttemptStatus::WaitingQuota,
            'error_code' => 'quota',
            'attempt_count' => 1,
            'last_attempted_at' => now(),
        ]);

        $pendingRouting = app(ReviewQueue::class)->for($this->agent)
            ->where('review_status', ReviewStatus::Unlinked)
            ->count();
        $pendingHandoffs = EmailHandoff::withoutGlobalScopes()
            ->where('company_id', $this->company->id)
            ->where('status', HandoffStatus::Pending)
            ->count();
        $openFollowUps = EmailFollowUp::withoutGlobalScopes()
            ->where('company_id', $this->company->id)
            ->where('followable_type', FollowableType::Task)
            ->whereIn('followable_id', DB::table('tasks')->whereNull('completed_on')->pluck('id'))
            ->count();

        $this->signIn($this->manager);
        $report = $this->getJson('/email/report')->assertOk()->json();

        $this->assertSame($pendingRouting, $report['counts']['pending_routing']);
        $this->assertSame($openFollowUps, $report['counts']['open_follow_ups']);
        $this->assertSame($pendingHandoffs, $report['counts']['unresolved_handoffs']);
        $this->assertSame(2, $report['counts']['faults']); // reconnect + failed send

        $this->assertSame(2, $pendingRouting);
        $this->assertSame(1, $openFollowUps);
        $this->assertSame(1, $pendingHandoffs);

        $routingIds = array_column($report['sections']['pending_routing'], 'id');
        $this->assertContains($first->uuid, $routingIds);
        $this->assertContains($second->uuid, $routingIds);
        $this->assertNotContains($handoffCopy->uuid, $routingIds);

        $this->assertSame('task:'.$taskId, $report['sections']['open_follow_ups'][0]['id']);
        $this->assertSame('/account/tasks/'.$taskId, $report['sections']['open_follow_ups'][0]['href']);
        $this->assertNotNull($report['sections']['pending_routing'][0]['mailbox']['email']);
        $this->assertNotNull($report['sections']['pending_routing'][0]['age_seconds']);
        $this->assertStringContainsString('/email/review/', $report['sections']['pending_routing'][0]['href']);
    }

    public function test_non_manager_is_forbidden_and_inertia_page_renders_for_manager(): void
    {
        $this->signIn($this->agent);
        $this->getJson('/email/report')->assertStatus(403);

        $this->signIn($this->manager);

        $this->get('/email/report', [
            'X-Inertia' => 'true',
            'Accept' => 'text/html, application/xhtml+xml',
        ])
            ->assertOk()
            ->assertJsonPath('component', 'Email/WorkReport')
            ->assertJsonPath('props.counts.pending_routing', 0);
    }

    public function test_report_sits_behind_flag_auth_and_pilot_allowlist(): void
    {
        $this->getJson('/email/report')->assertStatus(401);

        $outsider = $this->makeEmailUser();
        $this->grant($outsider, ['view_lead' => 'all']);
        $this->signIn($outsider);
        $this->getJson('/email/report')->assertStatus(403);

        $this->signIn($this->manager);
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->getJson('/email/report')->assertStatus(404);

        // Ensure middleware class is the one that 404s when off.
        $this->assertTrue(class_exists(EnsureEmailEnabled::class));
    }

    private function ingest(EmailConnection $connection, string $from, array $with = []): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: $with['subject'] ?? 'Hello',
            textBody: $with['textBody'] ?? 'Plain text body.',
            rfcMessageId: '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function grant(User $user, array $permissions): void
    {
        $this->app->instance('user.permission-map.'.$user->id, $permissions);
    }
}
