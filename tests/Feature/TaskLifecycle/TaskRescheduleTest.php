<?php

namespace Tests\Feature\TaskLifecycle;

use App\Http\Controllers\TaskController;
use App\Models\Task;
use App\Models\User;
use App\Services\Reminders\TaskReminderSync;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use ReflectionClass;
use Tests\TaskLifecycleTestCase;

/**
 * tasks.reschedule exists so the dashboard queue can move a due date without
 * going through tasks.update.
 *
 * The whole point is that it touches one column. Routing a row-level
 * reschedule through update() would resend heading, description, priority and
 * assignees from a page snapshot that may be minutes stale, silently reverting
 * a concurrent edit made on the task page. These tests are what stop someone
 * "simplifying" it back into update().
 */
class TaskRescheduleTest extends TaskLifecycleTestCase
{
    private TaskController $controller;

    protected function setUp(): void
    {
        parent::setUp();

        // The reminder sync needs queue/notification infrastructure this
        // schema does not carry; the reschedule behaviour is what is under test.
        $this->app->instance(TaskReminderSync::class, Mockery::mock(TaskReminderSync::class)
            ->shouldReceive('syncFromTask')->andReturnNull()->getMock());

        $this->controller = (new ReflectionClass(TaskController::class))
            ->newInstanceWithoutConstructor();

        $this->createPermissionSchema();

        // TaskObserver fans out to calendar sync, notifications and activity
        // feeds — none of which this schema carries, and none of which are
        // what reschedule() is responsible for. The save itself is under test.
        Task::unsetEventDispatcher();

        // setUser, not loginUsingId — the login event fires listeners that
        // reach tables this minimal schema does not carry.
        Auth::setUser(User::findOrFail($this->assignerId));
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_it_moves_the_due_date_and_leaves_everything_else_alone(): void
    {
        $task = $this->createTask(assigneeIds: [$this->assigneeOneId]);
        $task->heading = 'Send the reservation agreement';
        $task->description = 'Original description';
        $task->priority = 'high';
        $this->saveTaskWithoutObservers($task);

        $before = Task::findOrFail($task->id);

        $this->controller->reschedule(
            $this->request(['due_date' => '2026-12-24']),
            $task->id,
        );

        $after = Task::with('users')->findOrFail($task->id);

        $this->assertSame('2026-12-24', $after->due_date->format('Y-m-d'));
        $this->assertSame($before->heading, $after->heading);
        $this->assertSame($before->description, $after->description);
        $this->assertSame($before->priority, $after->priority);
        $this->assertSame(
            [$this->assigneeOneId],
            $after->users->pluck('id')->all(),
            'Rescheduling re-synced assignees',
        );
    }

    public function test_it_defaults_to_end_of_day_when_no_time_is_given(): void
    {
        $task = $this->createTask();

        $this->controller->reschedule(
            $this->request(['due_date' => '2026-12-24']),
            $task->id,
        );

        $this->assertSame(
            '17:00',
            Task::findOrFail($task->id)->due_date->format('H:i'),
        );
    }

    public function test_it_honours_an_explicit_time(): void
    {
        $task = $this->createTask();

        $this->controller->reschedule(
            $this->request(['due_date' => '2026-12-24', 'due_time' => '09:30']),
            $task->id,
        );

        $this->assertSame(
            '2026-12-24 09:30',
            Task::findOrFail($task->id)->due_date->format('Y-m-d H:i'),
        );
    }

    public function test_it_rejects_a_non_iso_date(): void
    {
        $task = $this->createTask();

        $this->expectException(ValidationException::class);

        // d-m-Y is what several other task endpoints accept, so this is the
        // realistic way to get it wrong.
        $this->controller->reschedule(
            $this->request(['due_date' => '24-12-2026']),
            $task->id,
        );
    }

    public function test_it_rejects_a_missing_date(): void
    {
        $task = $this->createTask();

        $this->expectException(ValidationException::class);

        $this->controller->reschedule($this->request([]), $task->id);
    }

    private function request(array $payload): Request
    {
        $request = Request::create('/account/tasks/1/reschedule', 'POST', $payload);
        $this->app->instance('request', $request);

        return $request;
    }

    /**
     * The three tables behind User::permission(), plus an `edit_tasks: all`
     * grant for the acting user. canEditTask() reads these, and a reschedule
     * that skipped the permission check would be the bug worth catching.
     */
    private function createPermissionSchema(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
        });

        // user_roles() reads these; canEditTask() and isWatcherOnlyOnTaskDeals()
        // both branch on role membership. Left empty — the acting user is a
        // plain assignee, which is the case worth exercising.
        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('display_name')->nullable();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->unsignedInteger('role_id');
            $table->unsignedInteger('user_id');
        });

        // Read by the Reply helper on the way out.
        Schema::create('global_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('locale')->default('en');
        });

        DB::table('global_settings')->insert(['id' => 1, 'locale' => 'en']);

        // User appends a `modules` attribute that reads this on serialisation,
        // which the success response triggers via toFrontendArray().
        Schema::create('module_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('module_name');
            $table->string('status')->default('active');
            $table->string('type')->nullable();
        });

        DB::table('permissions')->insert(['id' => 1, 'name' => 'edit_tasks']);
        DB::table('permission_types')->insert(['id' => 4, 'name' => 'all']);
        DB::table('user_permissions')->insert([
            'user_id' => $this->assignerId,
            'permission_id' => 1,
            'permission_type_id' => 4,
        ]);
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('module_settings');
        Schema::dropIfExists('global_settings');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('permission_types');
        Schema::dropIfExists('permissions');

        parent::resetSchema();
    }
}
