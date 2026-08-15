<?php

namespace Tests\Feature\Dashboard;

use App\Models\Deal;
use App\Models\Lead;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

/**
 * "Records with no next step" replaces the old "no activity for N days" guess.
 *
 * Silence is not neglect — a quiet deal may be waiting on a notary — but a
 * record with no open next-step task is unambiguous, because somebody had to
 * deliberately not nominate one. These tests pin down what "open" means:
 * a completed or deleted next step does not count as cover.
 */
class NextStepTest extends TestCase
{
    private int $companyId = 1;

    private int $userId = 10;

    private int $agentId = 1;

    private int $todoColumnId = 1;

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
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_a_lead_with_no_next_step_is_listed(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');

        $this->assertSame(
            ['lead-1'],
            $this->keysWithoutNextStep(),
        );
    }

    public function test_an_open_next_step_covers_the_record(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');
        $this->makeNextStepTask(1, Lead::class, 1, $this->todoColumnId);

        $this->assertSame([], $this->keysWithoutNextStep());
    }

    public function test_a_plain_task_does_not_count_as_a_next_step(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');
        $this->makeNextStepTask(1, Lead::class, 1, $this->todoColumnId, isNextStep: false);

        $this->assertSame(
            ['lead-1'],
            $this->keysWithoutNextStep(),
            'Any old task was treated as a next step',
        );
    }

    public function test_a_completed_next_step_no_longer_covers_the_record(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');
        $this->makeNextStepTask(1, Lead::class, 1, $this->doneColumnId);

        $this->assertSame(
            ['lead-1'],
            $this->keysWithoutNextStep(),
            'A done next step is history — the record needs a new one',
        );
    }

    public function test_a_soft_deleted_next_step_does_not_cover_the_record(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');
        $this->makeNextStepTask(1, Lead::class, 1, $this->todoColumnId, deleted: true);

        $this->assertSame(['lead-1'], $this->keysWithoutNextStep());
    }

    public function test_open_deals_are_covered_too_and_won_ones_are_not_listed(): void
    {
        $this->makeDeal(1, 'Dubai Marina A-1204');
        $this->makeDeal(2, 'Antalya Residence 7B', outcome: 'won');

        $this->assertSame(
            ['deal-1'],
            $this->keysWithoutNextStep(),
            'A closed deal has no next step to nominate',
        );
    }

    public function test_a_contacted_lead_is_not_listed(): void
    {
        // The lead bucket is uncontacted leads: once someone has made contact,
        // the record's problem is a missing next step on the deal, not the lead.
        $this->makeLead(1, 'Sarah Al-Rashid', contacted: true);

        $this->assertSame([], $this->keysWithoutNextStep());
    }

    public function test_a_next_step_on_a_different_record_does_not_cover_this_one(): void
    {
        $this->makeLead(1, 'Sarah Al-Rashid');
        $this->makeLead(2, 'Irina Kessler');
        $this->makeNextStepTask(1, Lead::class, 2, $this->todoColumnId);

        $this->assertSame(['lead-1'], $this->keysWithoutNextStep());
    }

    /** @return array<int, string> "lead-1", "deal-3", … */
    private function keysWithoutNextStep(): array
    {
        $method = new ReflectionMethod(
            DashboardMetricsService::class,
            'recordsWithoutNextStep',
        );
        $method->setAccessible(true);

        $rows = $method->invoke(app(DashboardMetricsService::class), $this->userId, 25);

        return array_map(fn ($row) => "{$row['type']}-{$row['id']}", $rows);
    }

    private function makeLead(int $id, string $name, bool $contacted = false): void
    {
        DB::table('leads')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'client_name' => $name,
            'lead_owner' => $this->userId,
            'first_contacted_at' => $contacted ? now() : null,
            'created_at' => now()->subDays(10),
            'updated_at' => now(),
        ]);
    }

    private function makeDeal(int $id, string $name, ?string $outcome = null): void
    {
        DB::table('deals')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'name' => $name,
            'agent_id' => $this->agentId,
            'outcome_status' => $outcome,
            'created_at' => now()->subDays(20),
            'updated_at' => now(),
        ]);
    }

    private function makeNextStepTask(
        int $taskId,
        string $type,
        int $recordId,
        int $columnId,
        bool $isNextStep = true,
        bool $deleted = false,
    ): void {
        DB::table('tasks')->insert([
            'id' => $taskId,
            'company_id' => $this->companyId,
            'heading' => 'Book a viewing',
            'board_column_id' => $columnId,
            'is_next_step' => $isNextStep,
            'deleted_at' => $deleted ? now() : null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('taskables')->insert([
            'task_id' => $taskId,
            'taskable_type' => $type,
            'taskable_id' => $recordId,
        ]);
    }

    private function resetSchema(): void
    {
        foreach (['taskables', 'tasks', 'taskboard_columns', 'deals', 'leads', 'lead_agents', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('lead_owner')->nullable();
            $table->dateTime('first_contacted_at')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('agent_id')->nullable();
            $table->string('outcome_status')->nullable();
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
            $table->unsignedInteger('board_column_id')->nullable();
            $table->boolean('is_next_step')->default(false);
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('taskables', function (Blueprint $table) {
            $table->unsignedInteger('task_id');
            $table->string('taskable_type');
            $table->unsignedInteger('taskable_id');
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
        DB::table('lead_agents')->insert([
            'id' => $this->agentId,
            'company_id' => $this->companyId,
            'user_id' => $this->userId,
        ]);
        DB::table('taskboard_columns')->insert([
            ['id' => $this->todoColumnId, 'company_id' => $this->companyId, 'column_name' => 'To Do', 'slug' => 'to_do'],
            ['id' => $this->doneColumnId, 'company_id' => $this->companyId, 'column_name' => 'Done', 'slug' => 'done'],
        ]);
    }
}
