<?php

namespace Tests\Feature\Leads;

use App\Models\Company;
use App\Models\Lead;
use App\Models\Task;
use App\Models\User;
use App\Services\FeatureFlagService;
use App\Services\LeadService;
use App\Support\UserTimezone;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The Leads index "Next action" column: the soonest open task or scheduled
 * meeting on a lead.
 *
 * Two mechanisms have to agree — a raw SQL expression the page sorts and
 * filters on, and a per-page lookup that says what the action actually is.
 * These tests pin the boundary cases where they could drift: done tasks and
 * cancelled meetings are not "next", and the earlier of the two wins.
 */
class LeadNextActionTest extends TestCase
{
    private int $companyId = 1;

    private int $doneColumnId = 2;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        // user() reads the session before auth; leaving auth empty also keeps
        // CompanyScope inert, which is what lets this run on a stub schema.
        // Real User/Company models rather than stubs: attachNextActions() calls
        // Task::wallClockString(), which passes both into
        // UserTimezone::forViewer(?User, ?Company) — type-hinted, so an
        // anonymous class or stdClass is a TypeError, not a silent fallback.
        session(['user' => $this->viewerUser()]);

        // company() checks session('company') first, short-circuiting before
        // it ever touches user()->company. UTC keeps this a no-op shift, so
        // every pre-existing assertion below is unaffected; the timezone
        // conversion itself gets its own dedicated tests further down.
        session(['company' => $this->viewerCompany()]);
    }

    /** `id` is guarded on User, so it has to be assigned rather than mass-assigned. */
    private function viewerUser(?string $timezone = null): User
    {
        $user = new User();
        $user->id = 10;

        if ($timezone !== null) {
            $user->timezone = $timezone;
        }

        // permission() resolves through a container-scoped map keyed on the
        // user id, not the session, so it has to be primed for this stub
        // schema (which has none of the permission tables).
        app()->instance('user.permission-map.10', ['view_lead_follow_up' => 'all']);

        return $user;
    }

    private function viewerCompany(string $timezone = 'UTC'): Company
    {
        $company = new Company();
        $company->id = $this->companyId;
        $company->timezone = $timezone;

        return $company;
    }

    protected function tearDown(): void
    {
        \Carbon\Carbon::setTestNow();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_the_sooner_of_a_task_and_a_meeting_is_the_next_action(): void
    {
        $this->makeLead(1);
        $this->makeTask(1, 1, now()->addDays(3));
        $this->makeMeeting(1, 1, now()->addDay());

        $action = $this->nextActionFor(1);

        $this->assertSame('meeting', $action['type']);
        $this->assertSame('Site visit', $action['title']);
    }

    public function test_a_task_wins_when_it_is_due_first(): void
    {
        $this->makeLead(1);
        $this->makeTask(1, 1, now()->addDay());
        $this->makeMeeting(1, 1, now()->addDays(3));

        $action = $this->nextActionFor(1);

        $this->assertSame('task', $action['type']);
        $this->assertSame('Book a viewing', $action['title']);
    }

    public function test_done_tasks_and_non_scheduled_meetings_are_not_next_actions(): void
    {
        $this->makeLead(1);
        $this->makeTask(1, 1, now()->addDay(), columnId: $this->doneColumnId);
        $this->makeTask(2, 1, now()->addDay(), deleted: true);
        $this->makeMeeting(1, 1, now()->addDay(), status: 'cancelled');
        $this->makeMeeting(2, 1, now()->addDay(), status: 'completed');

        $this->assertNull($this->nextActionFor(1));
        $this->assertNull($this->nextActionAtFor(1), 'The sort expression disagreed with the cell');
    }

    public function test_an_overdue_item_is_still_the_next_action(): void
    {
        $this->makeLead(1);
        $this->makeTask(1, 1, now()->subDays(2));
        $this->makeTask(2, 1, now()->addDays(2));

        $action = $this->nextActionFor(1);

        $this->assertSame(
            now()->subDays(2)->format('Y-m-d H:i:s'),
            $action['due_at'],
            'An overdue task is the most urgent thing, not a skipped one',
        );
    }

    public function test_an_action_on_another_lead_does_not_leak(): void
    {
        $this->makeLead(1);
        $this->makeLead(2);
        $this->makeTask(1, 2, now()->addDay());

        $this->assertNull($this->nextActionFor(1));
        $this->assertNotNull($this->nextActionFor(2));
    }

    public function test_the_sort_expression_matches_the_attached_payload(): void
    {
        $this->makeLead(1);
        $this->makeMeeting(1, 1, now()->addDay());
        $this->makeTask(1, 1, now()->addDays(5));

        $this->assertSame($this->nextActionFor(1)['due_at'], $this->nextActionAtFor(1));
    }

    public function test_meeting_due_at_is_converted_from_utc_for_the_viewer(): void
    {
        // lead_follow_up.next_follow_up_date is stored as true UTC (see
        // DealController::followUpStore's ->setTimezone('UTC')). Asia/Tokyo
        // is UTC+9 with no DST, so the expected shift is unambiguous.
        session(['company' => $this->viewerCompany('Asia/Tokyo')]);

        $this->makeLead(1);
        $this->makeMeeting(1, 1, \Carbon\Carbon::parse('2026-08-14 09:00:00', 'UTC'));

        $action = $this->nextActionFor(1);

        $this->assertSame('meeting', $action['type']);
        $this->assertSame(
            '2026-08-14 18:00:00',
            $action['due_at'],
            'due_at should be the Tokyo wall-clock time (09:00 UTC + 9h), not the raw UTC digits',
        );
    }

    public function test_task_due_at_is_converted_from_utc_for_the_viewer(): void
    {
        // tasks.due_date is a true UTC instant: every live write path runs
        session(['company' => $this->viewerCompany('Asia/Tokyo')]);

        $this->makeLead(1);
        // A task the user saved as 09:00 Tokyo wall-clock, i.e. 00:00 UTC.
        $this->makeTask(1, 1, \Carbon\Carbon::parse('2026-08-14 00:00:00', 'UTC'));

        $action = $this->nextActionFor(1);

        $this->assertSame('task', $action['type']);
        $this->assertSame(
            Task::wallClockString(\Carbon\Carbon::parse('2026-08-14 00:00:00', 'UTC')),
            $action['due_at'],
            'due_at must be the wall-clock time the task modal shows, never raw UTC digits',
        );
        $this->assertSame(
            '2026-08-14 09:00:00',
            $action['due_at'],
            'with the company zone at Asia/Tokyo the wall clock is 09:00 (00:00 UTC + 9h)',
        );
    }

    public function test_task_due_at_follows_the_viewers_own_timezone_not_the_companys(): void
    {
        // With crm.user-timezone on, a viewer's own zone wins over the company
        app(FeatureFlagService::class)->setTestingOverrides([
            UserTimezone::FLAG => true,
        ]);

        session(['company' => $this->viewerCompany('UTC')]);
        session(['user' => $this->viewerUser('Europe/Istanbul')]);

        $this->makeLead(1);
        $this->makeTask(1, 1, \Carbon\Carbon::parse('2026-08-14 06:00:00', 'UTC'));

        $this->assertSame(
            '2026-08-14 09:00:00',
            $this->nextActionFor(1)['due_at'],
            'a viewer in Istanbul should see 09:00 for an instant stored as 06:00 UTC',
        );
    }

    public function test_task_bucket_compares_instants_across_the_utc_date_rollover(): void
    {
        // Both sides of the filter are UTC instants, so a task 30 minutes
        // before "now" is overdue even when their calendar dates differ once
        // converted. Previously the task column was compared against a
        // company-local "now" while the meeting column was shifted into it,
        // so the same instant could bucket differently depending on the branch.
        //
        // Freeze UTC "now" late enough that Tokyo (+9h) has already rolled
        // to the next calendar date: 23:30 UTC on the 14th is 08:30 Tokyo
        // on the 15th.
        \Carbon\Carbon::setTestNow(\Carbon\Carbon::parse('2026-08-14 23:30:00', 'UTC'));
        session(['company' => $this->viewerCompany('Asia/Tokyo')]);

        $this->makeLead(1);
        // tasks.due_date holds a true UTC instant, so "30 minutes ago in Tokyo"
        // is stored as 23:00 UTC — the raw digits 08:00 on the 15th would be a
        // different instant entirely (eight and a half hours in the future).
        $this->makeTask(1, 1, \Carbon\Carbon::parse('2026-08-14 23:00:00', 'UTC'));

        $this->assertSame(
            [1],
            $this->leadIdsMatching('overdue'),
            'the filter compares two UTC instants, so this must read as overdue',
        );
    }

    #[DataProvider('bucketProvider')]
    public function test_urgency_buckets_select_the_right_leads(string $bucket, array $expected): void
    {
        $this->makeLead(1);   // overdue
        $this->makeTask(1, 1, now()->subHour());
        $this->makeLead(2);   // later today
        $this->makeTask(2, 2, now()->addMinutes(30));
        $this->makeLead(3);   // inside the week
        $this->makeTask(3, 3, now()->addDays(3));
        $this->makeLead(4);   // beyond the week
        $this->makeTask(4, 4, now()->addDays(30));
        $this->makeLead(5);   // nothing scheduled

        $this->assertSame($expected, $this->leadIdsMatching($bucket));
    }

    public static function bucketProvider(): array
    {
        return [
            'overdue' => ['overdue', [1]],
            'today' => ['today', [2]],
            'week' => ['week', [2, 3]],
            'none' => ['none', [5]],
        ];
    }

    /** @return array<string, mixed>|null */
    private function nextActionFor(int $leadId): ?array
    {
        $leads = Lead::hydrate(
            DB::table('leads')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all()
        );

        $this->invoke('attachNextActions', $leads);

        return $leads->firstWhere('id', $leadId)?->next_action;
    }

    /** The value the index sorts by, straight out of the raw expression. */
    private function nextActionAtFor(int $leadId): ?string
    {
        [$sql, $bindings] = $this->invoke('nextActionAtSql');

        return DB::table('leads')
            ->where('id', $leadId)
            ->selectRaw("{$sql} as next_action_at", $bindings)
            ->value('next_action_at');
    }

    /** @return array<int, int> */
    private function leadIdsMatching(string $bucket): array
    {
        $query = Lead::query()->select('leads.id');

        $this->invoke('applyNextActionFilter', $query, $bucket);

        return $query->orderBy('leads.id')->pluck('leads.id')->map(fn ($id) => (int) $id)->all();
    }

    private function invoke(string $method, ...$args): mixed
    {
        $reflected = new ReflectionMethod(LeadService::class, $method);
        $reflected->setAccessible(true);

        return $reflected->invoke(app(LeadService::class), ...$args);
    }

    private function makeLead(int $id): void
    {
        DB::table('leads')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'client_name' => "Lead {$id}",
            'created_at' => now()->subDays(10),
            'updated_at' => now(),
        ]);
    }

    private function makeTask(
        int $taskId,
        int $leadId,
        $dueDate,
        ?int $columnId = 1,
        bool $deleted = false,
    ): void {
        DB::table('tasks')->insert([
            'id' => $taskId,
            'company_id' => $this->companyId,
            'heading' => 'Book a viewing',
            'due_date' => $dueDate->format('Y-m-d H:i:s'),
            'board_column_id' => $columnId,
            'deleted_at' => $deleted ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('taskables')->insert([
            'task_id' => $taskId,
            'taskable_type' => Lead::class,
            'taskable_id' => $leadId,
        ]);
    }

    private function makeMeeting(
        int $id,
        int $leadId,
        $date,
        string $status = 'scheduled',
    ): void {
        DB::table('lead_follow_up')->insert([
            'id' => $id,
            'lead_id' => $leadId,
            'status' => $status,
            'next_follow_up_date' => $date->format('Y-m-d H:i:s'),
            'remark' => '<p>Site visit</p>',
            'added_by' => 10,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function resetSchema(): void
    {
        foreach (['taskables', 'tasks', 'taskboard_columns', 'lead_follow_up', 'meeting_types', 'leads', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('meeting_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('meeting_type_id')->nullable();
            $table->string('status')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->text('remark')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('column_name');
            $table->string('slug');
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->dateTime('due_date')->nullable();
            $table->unsignedInteger('board_column_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedInteger('taskable_id');
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
        DB::table('taskboard_columns')->insert([
            ['id' => 1, 'company_id' => $this->companyId, 'column_name' => 'To Do', 'slug' => 'to_do'],
            ['id' => $this->doneColumnId, 'company_id' => $this->companyId, 'column_name' => 'Done', 'slug' => 'done'],
        ]);
    }
}
