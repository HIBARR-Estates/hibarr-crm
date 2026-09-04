<?php

namespace Tests\Feature\Dashboard;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use App\Services\CycleLevelSnapshotService;
use App\Services\CycleService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MlmCommissionService;
use App\Services\MlmNotificationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * distribute() is now a persist loop over preview().
 *
 * This is the highest-blast-radius edit in the dashboard work: distribute()
 * fires on DealWonEvent and writes money records. The existing MLM suites are
 * HTTP-level and 401 before reaching the service, so they could not catch a
 * regression here — these tests exercise the arithmetic directly.
 *
 * The contract: preview() returns exactly what distribute() persists, and
 * writes nothing itself.
 */
class CommissionPreviewTest extends TestCase
{
    private int $companyId = 1;

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
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_preview_writes_nothing(): void
    {
        $legs = $this->service()->preview($this->deal());

        $this->assertNotEmpty($legs, 'Fixture produced no legs to test with');
        $this->assertSame(
            0,
            MlmCommission::count(),
            'preview() persisted commission records',
        );
    }

    public function test_distribute_persists_exactly_what_preview_describes(): void
    {
        $service = $this->service();
        $deal = $this->deal();

        $legs = $service->preview($deal);
        $records = $service->distribute($deal);

        $this->assertCount(count($legs), $records);

        foreach ($legs as $index => $leg) {
            foreach ($leg as $column => $value) {
                $stored = $records[$index]->{$column};

                // type and status are cast to enums on read; compare the
                // backing values rather than the objects.
                if ($stored instanceof \BackedEnum) {
                    $stored = $stored->value;
                }

                $this->assertEquals(
                    $value,
                    $stored,
                    "Leg {$index} column {$column} drifted between preview and distribute",
                );
            }
        }
    }

    public function test_the_agent_leg_uses_their_level_percentage(): void
    {
        // Agent on 4%, max commission 10% → 4% of 200,000 = 8,000, and the
        // remaining 6% falls to the system leg.
        $legs = $this->service()->preview($this->deal(value: 200000));

        $agentLeg = collect($legs)->firstWhere('type', MlmCommissionType::Agent->value);
        $systemLeg = collect($legs)->firstWhere('type', MlmCommissionType::System->value);

        $this->assertSame(4.0, (float) $agentLeg['percentage']);
        $this->assertSame(8000.0, (float) $agentLeg['amount']);
        $this->assertSame(6.0, (float) $systemLeg['percentage']);
        $this->assertSame(12000.0, (float) $systemLeg['amount']);
    }

    public function test_a_zero_value_deal_produces_no_legs(): void
    {
        $this->assertSame([], $this->service()->preview($this->deal(value: 0)));
    }

    private function service(): MlmCommissionService
    {
        $level = new MlmLevel(['commission_percentage' => 4.0]);
        $level->id = 1;

        $levels = Mockery::mock(LevelService::class);
        $levels->shouldReceive('getCurrentLevel')->andReturn($level);

        $hierarchy = Mockery::mock(HierarchyService::class);
        // No upline: agent_hierarchy is empty in this product today, so this is
        // also the realistic case.
        $hierarchy->shouldReceive('getAncestorsWithLevels')->andReturn(collect());

        $cycles = Mockery::mock(CycleService::class);
        $cycles->shouldReceive('getActiveEnrollment')->andReturn(null);

        return new MlmCommissionService(
            $hierarchy,
            $levels,
            $cycles,
            Mockery::mock(CycleLevelSnapshotService::class),
            // These tests assert commission arithmetic only; notification
            // delivery is covered elsewhere.
            Mockery::mock(MlmNotificationService::class)->shouldIgnoreMissing(),
        );
    }

    private function deal(float $value = 100000): Deal
    {
        // Inserted directly: LeadAgentObserver fans out to metrics, levels and
        // cycle bookkeeping on save, none of which this test is about.
        DB::table('lead_agents')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'user_id' => 1,
        ]);

        $deal = new Deal([
            'company_id' => $this->companyId,
            'name' => 'Dubai Marina A-1204',
            'agent_id' => 1,
            'value' => $value,
            'max_commission_percentage' => 10,
        ]);
        $deal->id = 1;
        $deal->saveQuietly();

        return $deal;
    }

    private function resetSchema(): void
    {
        foreach (['mlm_commissions', 'mlm_settings', 'agent_cycle_enrollments', 'mlm_cycles', 'agent_level_history', 'mlm_levels', 'deal_package', 'packages', 'deals', 'lead_agents', 'companies'] as $table) {
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
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('agent_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->decimal('max_commission_percentage', 5, 2)->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamps();
        });

        // preview() checks every deal for a commission-configured package
        // before falling through to the level-based split, so these have to
        // exist even though this suite only exercises the level-based path.
        Schema::create('packages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('currency')->nullable();
            $table->string('commission_type')->nullable();
            $table->decimal('commission_value', 15, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('deal_package', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('package_id');
            $table->timestamps();
        });

        Schema::create('mlm_levels', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->unsignedInteger('rank')->nullable();
            $table->decimal('commission_percentage', 5, 2)->nullable();
            $table->decimal('direct_rate', 5, 2)->nullable();
            $table->decimal('override_rate', 5, 2)->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
        });

        // LeadAgent eager-loads level history and cycle enrolment. Both are
        // left empty — the level comes from the mocked LevelService and there
        // is no active cycle, which is the shape this product runs in today.
        Schema::create('agent_level_history', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('level_id')->nullable();
            $table->dateTime('assigned_at')->nullable();
        });

        // Read for the fallback max-commission percentage. Left empty so the
        // deal's own max_commission_percentage wins, which is the precedence
        // getMaxCommissionPercentage() documents.
        Schema::create('mlm_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->decimal('max_commission_percentage', 5, 2)->nullable();
        });

        Schema::create('mlm_cycles', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('status')->nullable();
            $table->decimal('max_commission_snapshot', 5, 2)->nullable();
        });

        Schema::create('agent_cycle_enrollments', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('cycle_id')->nullable();
            $table->string('status')->nullable();
            $table->dateTime('effective_start_date')->nullable();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('source_agent_id')->nullable();
            $table->unsignedInteger('level_id')->nullable();
            // Set on package-priced legs; null on the level-based ones here.
            $table->unsignedInteger('package_id')->nullable();
            $table->unsignedInteger('cycle_level_snapshot_id')->nullable();
            $table->decimal('percentage', 5, 2)->nullable();
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('type')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
    }
}
