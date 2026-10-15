<?php

namespace Tests\Feature;

use App\Models\CrmEvent;
use App\Models\Lead;
use App\Models\Task;
use App\Services\CallBridge\CallBridgeService;
use App\Services\FeatureFlagService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The call bridge is a pure integration layer: OL owns call data, the CRM
 * projects OL events onto crm_events and open call/callback tasks. These
 * cover that projection contract — timeline rows, idempotent replays, task
 * completion on answered calls, and the poller.
 */
class CallBridgeServiceTest extends TestCase
{
    private const COMPANY_ID = 1;

    private int $leadId;

    private int $doneColumnId;

    private int $todoColumnId;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        Cache::flush();

        // FeatureFlags lookups (CrmEventObserver, ReminderFeature) must not
        // hit the network or tables this minimal schema does not model.
        app(FeatureFlagService::class)->setTestingOverrides([]);

        $this->seedEventCategories();

        $this->todoColumnId = $this->insertColumn('To Do', 'todo');
        $this->doneColumnId = $this->insertColumn('Done', 'done');
        $this->leadId = $this->makeLead();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    // ─── Timeline projection ────────────────────────────────────────────

    public function test_call_started_is_logged_on_the_lead_timeline(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-1',
            'call_id' => 'call-1',
            'event' => 'call.started',
            'direction' => 'outbound',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_started', $event->eventType->slug);
        $this->assertSame(Lead::class, $event->model_type);
        $this->assertSame($this->leadId, (int) $event->model_id);
        $this->assertSame('user_generated', $event->generation_type->value);
        $this->assertSame('outbound', $event->direction->value);
        $this->assertSame('call-1', $event->metadata['call_id']);
        $this->assertSame('ol-evt-1', $event->metadata['ol_event_id']);

        // call_started is a first-contact slug: the lead gets stamped too.
        $this->assertNotNull(
            DB::table('leads')->where('id', $this->leadId)->value('first_contacted_at')
        );
        $this->assertSame(1, CrmEvent::withoutGlobalScopes()
            ->whereHas('eventType', fn ($q) => $q->where('slug', 'lead_first_contact'))
            ->count());
    }

    public function test_replayed_ol_event_is_not_logged_twice(): void
    {
        $payload = $this->olEvent([
            'id' => 'ol-evt-dup',
            'call_id' => 'call-dup',
            'event' => 'call.started',
        ]);

        $first = $this->service()->logCallEvent($payload);
        $second = $this->service()->logCallEvent($payload);

        $this->assertNotNull($first);
        $this->assertNull($second);
        $this->assertSame(1, $this->countEvents('call_started'));
    }

    public function test_missed_call_is_logged_as_missed_status(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-missed',
            'call_id' => 'call-missed',
            'event' => 'call.missed',
            'direction' => 'inbound',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_missed', $event->eventType->slug);
        $this->assertSame('missed', $event->status->value);
        $this->assertSame('inbound', $event->direction->value);
    }

    public function test_answered_status_is_logged_as_call_ended(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-answered',
            'call_id' => 'call-answered',
            'event' => 'call.status_changed',
            'status' => 'answered',
            'direction' => 'inbound',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_ended', $event->eventType->slug);
        $this->assertSame('completed', $event->status->value);
        $this->assertSame('inbound', $event->direction->value);
    }

    public function test_dropped_status_is_logged_as_missed(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-dropped',
            'call_id' => 'call-dropped',
            'event' => 'call.status_changed',
            'status' => 'dropped',
            'direction' => 'outbound',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_missed', $event->eventType->slug);
        $this->assertSame('missed', $event->status->value);
        $this->assertSame('outbound', $event->direction->value);
    }

    public function test_declined_status_is_logged_as_call_declined(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-declined',
            'call_id' => 'call-declined',
            'event' => 'call.status_changed',
            'status' => 'declined',
            'direction' => 'inbound',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_declined', $event->eventType->slug);
        $this->assertSame('rejected', $event->status->value);
    }

    public function test_voicemail_status_is_logged_and_does_not_complete_tasks(): void
    {
        $taskId = $this->makeCallTask('Call Back');

        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-voicemail',
            'call_id' => 'call-voicemail',
            'event' => 'call.status_changed',
            'status' => 'voicemail',
            'duration' => 25,
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_voicemail', $event->eventType->slug);
        $this->assertSame('completed', $event->status->value);

        // A voicemail is not an answered conversation — the callback stays open.
        $this->assertNull(DB::table('tasks')->where('id', $taskId)->value('completed_on'));
    }

    public function test_busy_status_is_logged_as_call_busy(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-busy',
            'call_id' => 'call-busy',
            'event' => 'call.status_changed',
            'status' => 'busy',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_busy', $event->eventType->slug);
        $this->assertSame('missed', $event->status->value);
    }

    public function test_failed_status_is_logged_as_call_failed(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-failed',
            'call_id' => 'call-failed',
            'event' => 'call.status_changed',
            'status' => 'failed',
        ]));

        $this->assertNotNull($event);
        $this->assertSame('call_failed', $event->eventType->slug);
        $this->assertSame('error_occurred', $event->status->value);
    }

    public function test_answered_status_via_status_event_completes_tasks(): void
    {
        $taskId = $this->makeCallTask('Call');

        // Answered detected purely from a status ping (raw event is not call.ended).
        $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-answered-status',
            'call_id' => 'call-answered-status',
            'event' => 'call.status_changed',
            'status' => 'answered',
            'duration' => 60,
        ]));

        $this->assertNotNull(DB::table('tasks')->where('id', $taskId)->value('completed_on'));
    }

    public function test_intermediate_status_pings_are_skipped(): void
    {
        $event = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-ringing',
            'call_id' => 'call-ringing',
            'event' => 'call.status_changed',
            'status' => 'ringing',
        ]));

        $this->assertNull($event);
        $this->assertSame(0, CrmEvent::withoutGlobalScopes()->count());

        // The ping is marked processed so it is not re-fetched on the next poll.
        $again = $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-ringing',
            'call_id' => 'call-ringing',
            'event' => 'call.status_changed',
            'status' => 'ringing',
        ]));
        $this->assertNull($again);
        $this->assertSame(0, CrmEvent::withoutGlobalScopes()->count());
    }

    // ─── Task projection ────────────────────────────────────────────────

    public function test_answered_call_end_completes_matching_call_tasks(): void
    {
        $taskId = $this->makeCallTask('Call Back');

        $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-end',
            'call_id' => 'call-end',
            'event' => 'call.ended',
            'status' => 'answered',
            'duration' => 42,
        ]));

        $task = DB::table('tasks')->where('id', $taskId)->first();
        $this->assertNotNull($task->completed_on, 'Answered call end must complete the task.');
        $this->assertSame($this->doneColumnId, (int) $task->board_column_id);

        // The call event and the completion are both mirrored onto the task.
        $this->assertSame(1, $this->countEvents('call_ended', Task::class, $taskId));
        $this->assertSame(1, $this->countEvents('task_completed', Task::class, $taskId));
    }

    public function test_missed_call_does_not_complete_tasks(): void
    {
        $taskId = $this->makeCallTask('Call');

        $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-missed-end',
            'call_id' => 'call-missed-end',
            'event' => 'call.ended',
            'status' => 'missed',
        ]));

        $task = DB::table('tasks')->where('id', $taskId)->first();
        $this->assertNull($task->completed_on);
        $this->assertSame($this->todoColumnId, (int) $task->board_column_id);
    }

    public function test_tasks_in_other_categories_are_left_alone(): void
    {
        $taskId = $this->makeCallTask('Website redesign');

        $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-other',
            'call_id' => 'call-other',
            'event' => 'call.ended',
            'status' => 'answered',
        ]));

        $task = DB::table('tasks')->where('id', $taskId)->first();
        $this->assertNull($task->completed_on);
        $this->assertSame(0, $this->countEvents('call_ended', Task::class, $taskId));
    }

    public function test_explicit_task_id_from_ol_wins_over_category_matching(): void
    {
        $taskId = $this->makeCallTask('Website redesign');

        $this->service()->logCallEvent($this->olEvent([
            'id' => 'ol-evt-explicit',
            'call_id' => 'call-explicit',
            'event' => 'call.ended',
            'status' => 'answered',
            'task_id' => $taskId,
        ]));

        $this->assertSame(1, $this->countEvents('call_ended', Task::class, $taskId));
        $task = DB::table('tasks')->where('id', $taskId)->first();
        $this->assertNotNull($task->completed_on);
    }

    // ─── Poller ─────────────────────────────────────────────────────────

    public function test_poll_projects_events_from_the_bridge(): void
    {
        $this->configureBridge();

        Http::fake([
            'https://bridge.test/v1/call-bridge/events*' => Http::response([
                'data' => [
                    'events' => [
                        $this->olEvent([
                            'id' => 'ol-evt-poll',
                            'call_id' => 'call-poll',
                            'event' => 'call.started',
                        ]),
                    ],
                    'cursor' => null,
                    'has_more' => false,
                ],
            ]),
        ]);

        $summary = $this->service()->poll();

        $this->assertSame(1, $summary['fetched']);
        $this->assertSame(1, $summary['logged']);
        $this->assertSame(0, $summary['skipped']);
        $this->assertSame(0, $summary['errors']);
        $this->assertSame(1, $this->countEvents('call_started'));

        // Re-polling the same event is a no-op, not a duplicate.
        $again = $this->service()->poll();
        $this->assertSame(0, $again['logged']);
        $this->assertSame(1, $again['skipped']);
    }

    public function test_poll_skips_intermediate_events_and_logs_outcomes(): void
    {
        $this->configureBridge();

        Http::fake([
            'https://bridge.test/v1/call-bridge/events*' => Http::response([
                'data' => [
                    'events' => [
                        $this->olEvent([
                            'id' => 'ol-evt-ring',
                            'call_id' => 'call-1',
                            'event' => 'call.status_changed',
                            'status' => 'ringing',
                        ]),
                        $this->olEvent([
                            'id' => 'ol-evt-answered',
                            'call_id' => 'call-1',
                            'event' => 'call.status_changed',
                            'status' => 'answered',
                            'direction' => 'inbound',
                        ]),
                        $this->olEvent([
                            'id' => 'ol-evt-end',
                            'call_id' => 'call-1',
                            'event' => 'call.ended',
                            'status' => 'dropped',
                            'direction' => 'inbound',
                        ]),
                    ],
                    'cursor' => null,
                    'has_more' => false,
                ],
            ]),
        ]);

        $summary = $this->service()->poll();

        $this->assertSame(3, $summary['fetched']);
        $this->assertSame(2, $summary['logged'], 'Ringing ping is skipped; answered and dropped are logged.');
        $this->assertSame(1, $summary['skipped']);
        $this->assertSame(1, $this->countEvents('call_ended'));
        $this->assertSame(1, $this->countEvents('call_missed'));
    }

    public function test_poll_is_a_no_op_when_bridge_is_not_configured(): void
    {
        Config::set('services.call_bridge.api_key', '');

        // poll() must return before any HTTP; a stray request fails the test.
        Http::preventStrayRequests();

        $summary = $this->service()->poll();

        $this->assertSame(['fetched' => 0, 'logged' => 0, 'skipped' => 0, 'errors' => 0], $summary);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private function service(): CallBridgeService
    {
        return app(CallBridgeService::class);
    }

    /** Merge defaults onto an OL event payload tied to the test lead. */
    private function olEvent(array $overrides = []): array
    {
        return array_merge([
            'entity_type' => 'lead',
            'entity_id' => $this->leadId,
            'company_id' => self::COMPANY_ID,
            'user_id' => 7,
            'occurred_at' => '2026-10-13T10:00:00Z',
        ], $overrides);
    }

    private function configureBridge(): void
    {
        Config::set('services.call_bridge.base_url', 'https://bridge.test/v1');
        Config::set('services.call_bridge.api_key', 'test-key');
    }

    private function makeLead(): int
    {
        return DB::table('leads')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'name' => 'Bridge Lead',
            'email' => 'bridge.lead@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Insert an open task in the given category, linked to the test lead. */
    private function makeCallTask(string $categoryName): int
    {
        $categoryId = DB::table('task_category')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'category_name' => $categoryName,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $taskId = DB::table('tasks')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'heading' => 'Follow up call',
            'task_category_id' => $categoryId,
            'board_column_id' => $this->todoColumnId,
            'priority' => 'medium',
            'status' => 'not_started',
            'column_priority' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('taskables')->insert([
            'task_id' => $taskId,
            'taskable_type' => Lead::class,
            'taskable_id' => $this->leadId,
        ]);

        return $taskId;
    }

    private function insertColumn(string $name, string $slug): int
    {
        return DB::table('taskboard_columns')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'column_name' => $name,
            'slug' => $slug,
            'label_color' => '#999999',
            'priority' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function countEvents(string $slug, ?string $modelType = null, ?int $modelId = null): int
    {
        return CrmEvent::withoutGlobalScopes()
            ->whereHas('eventType', fn ($q) => $q->where('slug', $slug))
            ->when($modelType, fn ($q) => $q->where('model_type', $modelType))
            ->when($modelId, fn ($q) => $q->where('model_id', $modelId))
            ->count();
    }

    /** Mirror config/crm_events.php categories so types can self-register. */
    private function seedEventCategories(): void
    {
        foreach (config('crm_events.categories', []) as $category) {
            DB::table('crm_event_categories')->insert([
                'company_id' => null,
                'name' => $category['name'],
                'slug' => $category['slug'],
                'description' => $category['description'] ?? null,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('crm_event_categories', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('category_id');
            $table->string('name');
            $table->string('slug');
            $table->string('description')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedInteger('business_rule_id')->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('sync_processing')->default(true);
            $table->text('metadata_schema')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->uuid('uuid');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('event_type_id');
            $table->string('generation_type');
            $table->string('status')->default('completed');
            $table->string('direction')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('model_type')->nullable();
            $table->unsignedBigInteger('model_id')->nullable();
            $table->uuid('correlation_id')->nullable();
            $table->unsignedInteger('causation_id')->nullable();
            $table->string('source')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('user_agent')->nullable();
            $table->text('metadata')->nullable();
            $table->timestamp('occurred_at')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->timestamp('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('date_format')->default('Y-m-d');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('project_name')->nullable();
            $table->boolean('need_approval_by_admin')->default(false);
            $table->string('project_short_code')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name')->nullable();
            $table->string('image')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('task_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name');
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->text('description')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->timestamp('start_date')->nullable();
            $table->timestamp('remind_at')->nullable();
            $table->text('reminders')->nullable();
            $table->unsignedInteger('project_id')->nullable();
            $table->unsignedInteger('task_category_id')->nullable();
            $table->string('priority')->default('medium');
            $table->string('status')->default('not_started');
            $table->unsignedInteger('board_column_id')->nullable();
            $table->integer('column_priority')->default(0);
            $table->timestamp('completed_on')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('recurring_task_id')->nullable();
            $table->unsignedInteger('dependent_task_id')->nullable();
            $table->unsignedInteger('milestone_id')->nullable();
            $table->boolean('is_private')->default(false);
            $table->boolean('billable')->default(false);
            $table->unsignedInteger('estimate_hours')->default(0);
            $table->unsignedInteger('estimate_minutes')->default(0);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->string('integration_origin')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedBigInteger('taskable_id');
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('column_name');
            $table->string('slug')->nullable();
            $table->string('label_color')->default('#999999');
            $table->integer('priority')->default(0);
            $table->timestamps();
        });

        Schema::create('task_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });
    }

    private function resetSchema(): void
    {
        foreach ([
            'task_users',
            'taskables',
            'tasks',
            'task_category',
            'taskboard_columns',
            'users',
            'projects',
            'companies',
            'deals',
            'leads',
            'crm_events',
            'crm_event_types',
            'crm_event_categories',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
