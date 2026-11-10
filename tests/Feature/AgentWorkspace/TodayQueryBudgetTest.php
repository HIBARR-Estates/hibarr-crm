<?php

namespace Tests\Feature\AgentWorkspace;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\Task;
use App\Services\Dashboard\DashboardMetricsService;
use App\Support\TaskPresenter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * Query budgets for Today's deferred groups. Each group must cost the same
 * number of queries whether the agent has two rows or twelve: a query per
 * row is what turns a snappy page into a slow one as the queue fills up.
 *
 * Like the other dashboard tests, the schema is hand-built in memory with
 * only the columns these queries read.
 */
class TodayQueryBudgetTest extends TestCase
{
    use SetsFeatureFlags;

    private const USER = 10;

    private const TODO = 1;

    private const DONE = 2;

    private const TABLES = [
        'companies', 'currencies', 'users', 'projects', 'taskboard_columns', 'tasks', 'task_users',
        'taskables', 'leads', 'deals', 'lead_agents', 'email_follow_ups', 'email_messages',
        'lead_follow_up', 'meeting_types', 'meeting_summaries', 'lead_pipelines', 'global_settings',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->dropSchema();
        $this->createSchema();
        $this->setFeatureFlag('crm.tasks-workspace-redesign', false);
    }

    protected function tearDown(): void
    {
        $this->dropSchema();
        parent::tearDown();
    }

    public function test_the_queue_costs_the_same_for_two_tasks_as_for_twelve(): void
    {
        $this->seedTasks(2);
        $few = $this->countQueries(fn () => $this->metrics()->personalQueue(self::USER));

        $this->seedTasks(10, startId: 100);
        $many = $this->countQueries(fn () => $this->metrics()->personalQueue(self::USER));

        $this->assertSame($few, $many, 'personalQueue runs a query per task');
        $this->assertCount(12, $this->metrics()->personalQueue(self::USER)['tasks']);
    }

    public function test_todays_tasks_cost_the_same_for_two_tasks_as_for_twelve(): void
    {
        [$from, $to] = [now()->startOfDay(), now()->endOfDay()];

        $this->seedTasks(2, due: now()->setTime(15, 0));
        $few = $this->countQueries(fn () => $this->metrics()->personalTasksBetween(self::USER, $from, $to));

        $this->seedTasks(10, startId: 100, due: now()->setTime(16, 0));
        $many = $this->countQueries(fn () => $this->metrics()->personalTasksBetween(self::USER, $from, $to));

        $this->assertSame($few, $many, 'personalTasksBetween runs a query per task');
        $this->assertCount(12, $this->metrics()->personalTasksBetween(self::USER, $from, $to));
    }

    public function test_todays_meetings_cost_the_same_for_two_meetings_as_for_twelve(): void
    {
        [$from, $to] = [now()->startOfDay(), now()->endOfDay()];

        $this->seedMeetings(2);
        $few = $this->countQueries(fn () => $this->metrics()->meetingsBetween(self::USER, $from, $to));

        $this->seedMeetings(10, startId: 100);
        $many = $this->countQueries(fn () => $this->metrics()->meetingsBetween(self::USER, $from, $to));

        $this->assertSame($few, $many, 'meetingsBetween runs a query per meeting');
        $this->assertCount(12, $this->metrics()->meetingsBetween(self::USER, $from, $to));
    }

    public function test_the_stats_group_costs_the_same_however_much_data_there_is(): void
    {
        $run = fn () => [
            $this->metrics()->personalStats(self::USER),
            $this->metrics()->openDealsByPipeline(self::USER),
        ];

        $this->seedMeetings(2);
        $few = $this->countQueries($run);

        $this->seedMeetings(10, startId: 100);
        $many = $this->countQueries($run);

        $this->assertSame($few, $many);
    }

    public function test_a_window_in_the_viewers_zone_is_read_as_that_zones_day(): void
    {
        // 23:30 in Istanbul is 20:30 UTC: inside Istanbul's "today" only.
        $istanbulDay = now('Europe/Istanbul')->startOfDay();
        $this->seedMeetings(1, at: $istanbulDay->copy()->setTime(23, 30)->utc());

        $inside = $this->metrics()->meetingsBetween(self::USER, $istanbulDay, $istanbulDay->copy()->endOfDay());
        $nextDay = $this->metrics()->meetingsBetween(
            self::USER,
            $istanbulDay->copy()->addDay(),
            $istanbulDay->copy()->addDay()->endOfDay()
        );

        $this->assertCount(1, $inside);
        $this->assertCount(0, $nextDay);
    }

    public function test_the_task_presenter_uses_an_email_link_looked_up_in_advance(): void
    {
        $task = new Task;
        $task->setRawAttributes([
            'id' => 5,
            'heading' => 'Call back',
            'board_column_id' => self::TODO,
            'created_at' => now(),
            'updated_at' => now(),
        ], true);
        $task->exists = true;
        foreach (['boardColumn', 'project', 'category', 'createBy', 'addedByUser'] as $relation) {
            $task->setRelation($relation, null);
        }
        foreach (['users', 'labels', 'subtasks', 'deals', 'leads', 'developerProjects', 'properties'] as $relation) {
            $task->setRelation($relation, new \Illuminate\Database\Eloquent\Collection);
        }
        $task->setAttribute('source_email_message_id', 'msg-9');

        DB::flushQueryLog();
        DB::enableQueryLog();
        $payload = TaskPresenter::present($task);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame('msg-9', $payload['source_email_message_id']);
        $this->assertSame([], $queries);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function metrics(): DashboardMetricsService
    {
        // A fresh service each time, so nothing memoised from one run makes
        // the next one look cheaper.
        return new DashboardMetricsService;
    }

    /** Queries for one warm run: lookups cached per request are already loaded. */
    private function countQueries(callable $run): int
    {
        $run();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $run();
        $count = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $count;
    }

    private function seedTasks(int $count, int $startId = 1, $due = null): void
    {
        for ($i = 0; $i < $count; $i++) {
            $id = $startId + $i;
            DB::table('tasks')->insert([
                'id' => $id,
                'company_id' => 1,
                'heading' => "Task {$id}",
                'board_column_id' => self::TODO,
                'project_id' => 1,
                'added_by' => self::USER,
                'priority' => 'medium',
                'due_date' => ($due ?? now()->subDays($i % 3))->format('Y-m-d H:i:s'),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('task_users')->insert(['task_id' => $id, 'user_id' => self::USER]);
            $isLead = $id % 2 === 0;
            DB::table('taskables')->insert([
                'task_id' => $id,
                'taskable_type' => $isLead ? Lead::class : Deal::class,
                'taskable_id' => $isLead ? 1 : 1,
            ]);
            DB::table('email_follow_ups')->insert([
                'followable_type' => 'task',
                'followable_id' => $id,
                'message_id' => 1,
            ]);
        }
    }

    private function seedMeetings(int $count, int $startId = 1, $at = null): void
    {
        for ($i = 0; $i < $count; $i++) {
            $id = $startId + $i;
            DB::table('lead_follow_up')->insert([
                'id' => $id,
                'deal_id' => $id % 2 ? 1 : null,
                'lead_id' => 1,
                'meeting_type_id' => 1,
                'next_follow_up_date' => ($at ?? now()->startOfDay()->addHours(9)->addMinutes($i))->format('Y-m-d H:i:s'),
                'duration' => 30,
                'status' => 'pending',
                'added_by' => self::USER,
                'participants' => json_encode([self::USER, 11]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function dropSchema(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('date_format')->default('d-m-Y');
            $table->string('time_format')->default('H:i');
            $table->string('timezone')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
        });
        Schema::create('currencies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('currency_code');
        });
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table) {
            $table->increments('id');
            $table->string('project_name');
            $table->string('project_short_code')->nullable();
            $table->string('need_approval_by_admin')->nullable();
            $table->softDeletes();
        });
        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('column_name');
            $table->string('slug');
            $table->string('label_color')->nullable();
            $table->integer('priority')->default(0);
        });
        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->text('description')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->dateTime('start_date')->nullable();
            $table->date('completed_on')->nullable();
            $table->unsignedInteger('board_column_id')->nullable();
            $table->unsignedInteger('project_id')->nullable();
            $table->unsignedInteger('task_category_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->string('priority')->default('medium');
            $table->string('status')->default('incomplete');
            $table->boolean('is_next_step')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });
        Schema::create('task_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });
        Schema::create('taskables', function (Blueprint $table) {
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedInteger('taskable_id');
        });
        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('company_name')->nullable();
            $table->string('mobile')->nullable();
            $table->string('cell')->nullable();
            $table->string('office')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->dateTime('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamps();
        });
        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
        });
        Schema::create('email_follow_ups', function (Blueprint $table) {
            $table->increments('id');
            $table->string('followable_type');
            $table->unsignedInteger('followable_id');
            $table->unsignedInteger('message_id')->nullable();
        });
        Schema::create('email_messages', function (Blueprint $table) {
            $table->increments('id');
            $table->string('uuid');
        });
        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->unsignedInteger('summary_id')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->integer('duration')->nullable();
            $table->string('status')->nullable();
            $table->string('location')->nullable();
            $table->string('meeting_link')->nullable();
            $table->string('attendance_outcome')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->text('participants')->nullable();
            $table->timestamps();
        });
        Schema::create('meeting_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });
        // Company's appended logo reads the global settings row (cached after
        // the first read, which setUp() does so every run starts warm).
        Schema::create('global_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('light_logo')->nullable();
            $table->string('logo')->nullable();
        });
        Schema::create('meeting_summaries', function (Blueprint $table) {
            $table->increments('id');
            $table->text('summary')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => 1, 'company_name' => 'Test']);
        DB::table('users')->insert([
            ['id' => self::USER, 'company_id' => 1, 'name' => 'Agent'],
            ['id' => 11, 'company_id' => 1, 'name' => 'Colleague'],
        ]);
        DB::table('projects')->insert(['id' => 1, 'project_name' => 'Sales']);
        DB::table('taskboard_columns')->insert([
            ['id' => self::TODO, 'company_id' => 1, 'column_name' => 'To Do', 'slug' => 'to_do', 'priority' => 1],
            ['id' => self::DONE, 'company_id' => 1, 'column_name' => 'Done', 'slug' => 'done', 'priority' => 2],
        ]);
        DB::table('leads')->insert(['id' => 1, 'company_id' => 1, 'client_name' => 'Jana Hoffmann', 'lead_owner' => self::USER]);
        DB::table('deals')->insert(['id' => 1, 'company_id' => 1, 'name' => 'Jana · Kyrenia', 'lead_id' => 1, 'agent_id' => 1]);
        DB::table('lead_agents')->insert(['id' => 1, 'company_id' => 1, 'user_id' => self::USER]);
        DB::table('meeting_types')->insert(['id' => 1, 'name' => 'Kick Off']);
        DB::table('email_messages')->insert(['id' => 1, 'uuid' => 'msg-1']);
        DB::table('lead_pipelines')->insert(['id' => 1, 'name' => 'Sales']);
        DB::table('deals')->where('id', 1)->update(['lead_pipeline_id' => 1]);
        DB::table('global_settings')->insert(['id' => 1]);
        global_setting();
    }
}
