<?php

namespace Tests;

use App\Models\Task;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;

abstract class TaskLifecycleTestCase extends TestCase
{
    use SetsFeatureFlags;

    protected int $companyId = 1;

    protected int $assignerId = 1;

    protected int $assigneeOneId = 2;

    protected int $assigneeTwoId = 3;

    protected int $todoColumnId = 1;

    protected int $doneColumnId = 2;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedBaseData();

        \App\Services\TaskLifecycleNotificationService::resetOncePerRequest();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('mention_users');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('task_users');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('taskboard_columns');
        Schema::dropIfExists('email_notification_settings');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    protected function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('timezone')->default('UTC');
            $table->string('date_format')->default('Y-m-d');
            $table->string('time_format')->default('H:i');
            $table->string('header_color')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->boolean('email_notifications')->default(true);
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('mention_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            // ClientContact is company-scoped; User eager-loads it, so any
            // query for a user applies CompanyScope to this table.
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->unsignedInteger('client_id')->nullable();
            $table->timestamps();
        });

        Schema::create('taskboard_columns', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('column_name');
            $table->string('slug');
            $table->timestamps();
        });

        Schema::create('tasks', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('heading');
            $table->text('description')->nullable();
            $table->unsignedInteger('board_column_id');
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('created_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->dateTime('due_date')->nullable();
            $table->string('priority')->default('medium');
            $table->string('task_short_code')->nullable();
            // Task uses SoftDeletes, so any query that goes through the model
            // (rather than saveTaskWithoutObservers) filters on this.
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('task_users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('task_id');
            $table->unsignedInteger('user_id');
            $table->timestamps();
        });

        Schema::create('email_notification_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->string('slug');
            $table->string('send_email')->default('yes');
            $table->string('send_slack')->default('no');
            $table->string('send_push')->default('no');
            $table->timestamps();
        });
    }

    protected function seedBaseData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'timezone' => 'UTC',
            'date_format' => 'Y-m-d',
            'time_format' => 'H:i',
            'header_color' => '#000000',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([
            [$this->assignerId, 'Assigner'],
            [$this->assigneeOneId, 'Assignee One'],
            [$this->assigneeTwoId, 'Assignee Two'],
        ] as [$id, $name]) {
            DB::table('users')->insert([
                'id' => $id,
                'company_id' => $this->companyId,
                'name' => $name,
                'email' => strtolower(str_replace(' ', '.', $name)).'@test.local',
                'email_notifications' => true,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        DB::table('taskboard_columns')->insert([
            [
                'id' => $this->todoColumnId,
                'company_id' => $this->companyId,
                'column_name' => 'To Do',
                'slug' => 'to_do',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => $this->doneColumnId,
                'company_id' => $this->companyId,
                'column_name' => 'Done',
                'slug' => 'done',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        foreach (['user-assign-to-task', 'task-completed'] as $slug) {
            DB::table('email_notification_settings')->insert([
                'company_id' => $this->companyId,
                'slug' => $slug,
                'send_email' => 'yes',
                'send_slack' => 'no',
                'send_push' => 'no',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    protected function enableLifecycleFlag(): void
    {
        $this->setFeatureFlag('crm.task-lifecycle-notifications', true);
    }

    protected function createTask(array $overrides = [], array $assigneeIds = []): \App\Models\Task
    {
        $taskId = DB::table('tasks')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'heading' => 'Lifecycle Task',
            'description' => 'Task body',
            'board_column_id' => $this->todoColumnId,
            'added_by' => $this->assignerId,
            'created_by' => $this->assignerId,
            'priority' => 'high',
            'due_date' => now()->addDay(),
            'task_short_code' => 'T-1',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));

        foreach ($assigneeIds as $assigneeId) {
            DB::table('task_users')->insert([
                'task_id' => $taskId,
                'user_id' => $assigneeId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return \App\Models\Task::withoutGlobalScopes()
            ->setEagerLoads([])
            ->findOrFail($taskId);
    }

    protected function user(int $id): \App\Models\User
    {
        return \App\Models\User::withoutGlobalScopes()->findOrFail($id);
    }

    protected function saveTaskWithoutObservers(Task $task): void
    {
        Task::withoutEvents(function () use ($task) {
            $task->save();
        });
    }
}
