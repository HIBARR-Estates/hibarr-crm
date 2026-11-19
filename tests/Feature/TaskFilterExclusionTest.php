<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskSavedView;
use App\Services\TaskFilters;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * "Is not", "Is empty" and "Has any" on the Tasks filters (`<key>_mode`), plus
 * the "is one of" behaviour those blocks had before they moved out of
 * TaskController, so the move is covered as well as the new modes.
 */
class TaskFilterExclusionTest extends TestCase
{
    private int $companyId = 1;

    private int $todoColumn;

    private int $doingColumn;

    private int $doneColumn;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();

        // company() reads the session; the board-column lookup is per company.
        session(['company' => (object) ['id' => $this->companyId]]);

        $this->todoColumn = $this->insertColumn('todo');
        $this->doingColumn = $this->insertColumn('doing');
        $this->doneColumn = $this->insertColumn('done');
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    // ── assignees (users pivot) ──────────────────────────────────────────

    public function test_assigned_to_empty_any_and_not_in(): void
    {
        $toAnna = $this->insertTask();
        $this->assign($toAnna, 11);
        $toBen = $this->insertTask();
        $this->assign($toBen, 12);
        $toBoth = $this->insertTask();
        $this->assign($toBoth, 11);
        $this->assign($toBoth, 12);
        $unassigned = $this->insertTask();

        $this->assertSame([$unassigned], $this->ids(['assigned_to_mode' => 'empty']));
        $this->assertSame([$toAnna, $toBen, $toBoth], $this->ids(['assigned_to_mode' => 'any']));
        // "Not Anna" leaves out anyone she shares a task with, and keeps the unassigned.
        $this->assertSame([$toBen, $unassigned], $this->ids(['assigned_to' => '11', 'assigned_to_mode' => 'not_in']));
        // Unchanged: "is one of".
        $this->assertSame([$toAnna, $toBoth], $this->ids(['assigned_to' => '11']));
    }

    // ── status (board column, with the `pending` pseudo-status) ──────────

    public function test_status_not_in_keeps_tasks_in_other_columns_and_with_no_column(): void
    {
        $todo = $this->insertTask(['board_column_id' => $this->todoColumn]);
        $doing = $this->insertTask(['board_column_id' => $this->doingColumn]);
        $done = $this->insertTask(['board_column_id' => $this->doneColumn]);
        $noColumn = $this->insertTask(['board_column_id' => null]);

        $this->assertSame(
            [$todo, $doing, $noColumn],
            $this->ids(['status' => 'done', 'status_mode' => 'not_in'])
        );
        $this->assertSame([$doing, $noColumn], $this->ids(['status' => 'todo,done', 'status_mode' => 'not_in']));
        // Unchanged: "is one of".
        $this->assertSame([$done], $this->ids(['status' => 'done']));
        $this->assertSame([$todo, $doing], $this->ids(['status' => 'todo,doing']));
    }

    public function test_status_pending_still_means_not_complete_and_its_exclusion_means_complete(): void
    {
        $todo = $this->insertTask(['board_column_id' => $this->todoColumn]);
        $done = $this->insertTask(['board_column_id' => $this->doneColumn]);
        $noColumn = $this->insertTask(['board_column_id' => null]);

        $this->assertSame([$todo], $this->ids(['status' => 'pending']));
        $this->assertSame([$done, $noColumn], $this->ids(['status' => 'pending', 'status_mode' => 'not_in']));
    }

    // ── priority (text) ──────────────────────────────────────────────────

    public function test_priority_exclusions_keep_unset_and_treat_blank_as_empty(): void
    {
        $high = $this->insertTask(['priority' => 'high']);
        $low = $this->insertTask(['priority' => 'low']);
        $blank = $this->insertTask(['priority' => '']);
        $null = $this->insertTask(['priority' => null]);

        $this->assertSame([$low, $blank, $null], $this->ids(['priority' => 'high', 'priority_mode' => 'not_in']));
        $this->assertSame([$blank, $null], $this->ids(['priority_mode' => 'empty']));
        $this->assertSame([$high], $this->ids(['priority' => 'high']));
    }

    // ── category and project (scalar columns) ────────────────────────────

    public function test_category_exclusions(): void
    {
        $a = $this->insertTask(['task_category_id' => 1]);
        $b = $this->insertTask(['task_category_id' => 2]);
        $none = $this->insertTask(['task_category_id' => null]);

        $this->assertSame([$b, $none], $this->ids(['category_id' => '1', 'category_id_mode' => 'not_in']));
        $this->assertSame([$none], $this->ids(['category_id_mode' => 'empty']));
    }

    public function test_project_is_a_single_pick_and_its_exclusions_keep_standalone_tasks(): void
    {
        $inFive = $this->insertTask(['project_id' => 5]);
        $inSix = $this->insertTask(['project_id' => 6]);
        $standalone = $this->insertTask(['project_id' => null]);

        $this->assertSame([$inFive], $this->ids(['project_id' => '5']));
        $this->assertSame([$inFive, $inSix, $standalone], $this->ids(['project_id' => 'all']));
        $this->assertSame([$inSix, $standalone], $this->ids(['project_id' => '5', 'project_id_mode' => 'not_in']));
        $this->assertSame([$standalone], $this->ids(['project_id_mode' => 'empty']));
    }

    // ── labels (pivot) ───────────────────────────────────────────────────

    public function test_labels_not_in_empty_and_any(): void
    {
        $bug = $this->insertLabel('Bug');
        $docs = $this->insertLabel('Docs');

        $onBug = $this->insertTask();
        $this->attachLabel($onBug, $bug);
        $onBoth = $this->insertTask();
        $this->attachLabel($onBoth, $bug);
        $this->attachLabel($onBoth, $docs);
        $onDocs = $this->insertTask();
        $this->attachLabel($onDocs, $docs);
        $bare = $this->insertTask();

        $this->assertSame([$onDocs, $bare], $this->ids(['labels' => (string) $bug, 'labels_mode' => 'not_in']));
        $this->assertSame([$bare], $this->ids(['labels_mode' => 'empty']));
        $this->assertSame([$onBug, $onBoth, $onDocs], $this->ids(['labels_mode' => 'any']));
        $this->assertSame([$onBug, $onBoth], $this->ids(['labels' => (string) $bug]));
    }

    // ── assigner (added_by or created_by) ────────────────────────────────

    public function test_assigned_by_not_in_rules_out_both_the_adder_and_the_creator(): void
    {
        $addedByAnna = $this->insertTask(['added_by' => 11, 'created_by' => null]);
        $createdByAnna = $this->insertTask(['added_by' => null, 'created_by' => 11]);
        $byBen = $this->insertTask(['added_by' => 12, 'created_by' => 12]);
        $nobody = $this->insertTask(['added_by' => null, 'created_by' => null]);

        $this->assertSame([$byBen, $nobody], $this->ids(['assigned_by' => '11', 'assigned_by_mode' => 'not_in']));
        // Unchanged: "is one of" matches either column.
        $this->assertSame([$addedByAnna, $createdByAnna], $this->ids(['assigned_by' => '11']));
    }

    // ── due date ─────────────────────────────────────────────────────────

    public function test_due_date_mode_replaces_the_range_and_leaves_it_alone_otherwise(): void
    {
        $due = $this->insertTask(['due_date' => '2026-02-01 10:00:00']);
        $open = $this->insertTask(['due_date' => null]);

        $filters = new TaskFilters;

        $empty = Task::query();
        $this->assertTrue($filters->applyDueMode($empty, Request::create('/', 'GET', ['due_date_range_mode' => 'empty'])));
        $this->assertSame([$open], $this->idsOf($empty));

        $any = Task::query();
        $this->assertTrue($filters->applyDueMode($any, Request::create('/', 'GET', ['due_date_range_mode' => 'any', 'due_start_date' => '2026-03-01'])));
        $this->assertSame([$due], $this->idsOf($any));

        // No mode: the caller still applies the range.
        $range = Task::query();
        $this->assertFalse($filters->applyDueMode($range, Request::create('/', 'GET', ['due_start_date' => '2026-01-01'])));
        // `in` is not a mode a date can take.
        $this->assertFalse($filters->applyDueMode(Task::query(), Request::create('/', 'GET', ['due_date_range_mode' => 'not_in'])));
    }

    public function test_a_mode_a_filter_does_not_offer_is_ignored(): void
    {
        $a = $this->insertTask(['priority' => 'high', 'task_category_id' => 1, 'project_id' => 5, 'added_by' => 11, 'board_column_id' => $this->todoColumn]);
        $b = $this->insertTask(['priority' => null, 'task_category_id' => null, 'project_id' => null, 'added_by' => null, 'board_column_id' => null]);

        // The modal offers these "is not" / "is empty" (assigned by and status: "is not" only), never the rest.
        foreach (['priority_mode' => 'any', 'category_id_mode' => 'any', 'project_id_mode' => 'any', 'assigned_by_mode' => 'empty', 'assigned_by_mode ' => 'any', 'status_mode' => 'empty'] as $key => $mode) {
            $this->assertSame([$a, $b], $this->ids([trim($key) => $mode]), trim($key)." takes no '{$mode}'");
        }
    }

    // ── whitelist ────────────────────────────────────────────────────────

    public function test_saved_views_keep_modes_and_drop_anything_that_is_not_one(): void
    {
        $result = TaskSavedView::sanitizeFilters([
            'assigned_to_mode' => 'empty',
            'status' => 'done',
            'status_mode' => 'not_in',
            'labels_mode' => 'sideways',
            'due_date_range_mode' => 'any',
            'per_page' => 5000,
            'unknown_mode' => 'empty',
            // Modes the filter does not offer are not modes.
            'priority_mode' => 'any',
            'assigned_by_mode' => 'empty',
        ]);

        $this->assertSame(
            ['assigned_to_mode' => 'empty', 'status' => 'done', 'status_mode' => 'not_in', 'due_date_range_mode' => 'any'],
            $result
        );
    }

    public function test_every_mode_key_is_a_saved_view_key(): void
    {
        $source = file_get_contents(__DIR__.'/../../app/Models/TaskSavedView.php');

        foreach (TaskFilters::modeKeys() as $key) {
            $this->assertStringContainsString("'{$key}'", $source, "TaskSavedView does not whitelist '{$key}'.");
        }
    }

    // ── harness ──────────────────────────────────────────────────────────

    /**
     * @param  array<string, string>  $params
     * @return array<int, int>
     */
    private function ids(array $params): array
    {
        $query = Task::query();
        (new TaskFilters)->apply($query, Request::create('/tasks', 'GET', $params));

        return $this->idsOf($query);
    }

    /** @return array<int, int> */
    private function idsOf($query): array
    {
        return $query->orderBy('tasks.id')->pluck('tasks.id')->map(fn ($id) => (int) $id)->all();
    }

    private function insertColumn(string $slug): int
    {
        return (int) DB::table('taskboard_columns')->insertGetId([
            'company_id' => $this->companyId,
            'slug' => $slug,
            'column_name' => ucfirst($slug),
            'priority' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function assign(int $taskId, int $userId): void
    {
        DB::table('users')->insertOrIgnore(['id' => $userId, 'name' => "User {$userId}", 'status' => 'active']);
        DB::table('task_users')->insert(['task_id' => $taskId, 'user_id' => $userId]);
    }

    private function insertLabel(string $name): int
    {
        return (int) DB::table('task_label_list')->insertGetId([
            'company_id' => $this->companyId,
            'label_name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachLabel(int $taskId, int $labelId): void
    {
        DB::table('task_labels')->insert(['task_id' => $taskId, 'label_id' => $labelId]);
    }

    /** @param  array<string, mixed>  $attributes */
    private function insertTask(array $attributes = []): int
    {
        return (int) DB::table('tasks')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'heading' => 'Task',
            'project_id' => null,
            'task_category_id' => null,
            'priority' => null,
            'board_column_id' => null,
            'due_date' => null,
            'added_by' => null,
            'created_by' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function resetSchema(): void
    {
        foreach (['task_labels', 'task_label_list', 'task_users', 'users', 'taskboard_columns', 'tasks'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('heading');
            $table->unsignedInteger('project_id')->nullable();
            $table->unsignedInteger('task_category_id')->nullable();
            $table->string('priority')->nullable();
            $table->unsignedInteger('board_column_id')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('column_name')->nullable();
            $table->integer('priority')->default(1);
            $table->string('label_color')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('status')->default('active');
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('task_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('task_label_list', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label_name');
            $table->timestamps();
        });

        Schema::create('task_labels', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('label_id');
        });
    }
}
