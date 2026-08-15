<?php

namespace Tests\Feature\Dashboard;

use App\Models\Deal;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Median days in stage, read from crm_events.
 *
 * deal_histories cannot back this — it holds a couple of stage rows across the
 * whole database, because every path that moves a stage either uses
 * saveQuietly(), mass-updates past the observer, or used to throw on a null
 * user. crm_events is the trail that actually gets written.
 *
 * Two things these tests exist to protect: the three writers disagree on the
 * metadata key names and on whether stage ids are ints or strings, and open
 * dwells must never be mixed into the closed-dwell median (they are
 * right-censored, so folding them in makes slow stages look fast).
 */
class StageDwellTest extends TestCase
{
    private int $companyId = 1;

    private int $agentId = 1;

    private int $eventId = 1;

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

    public function test_two_events_five_days_apart_give_a_five_day_dwell(): void
    {
        $this->deal(1);
        $this->stageEvent(1, from: null, to: 10, at: now()->subDays(15));
        $this->stageEvent(1, from: 10, to: 20, at: now()->subDays(10));

        $dwell = $this->dwell();

        $this->assertSame(5.0, $dwell[10]['median_days']);
        $this->assertSame(1, $dwell[10]['samples']);
    }

    public function test_observer_and_automation_metadata_shapes_land_in_the_same_bucket(): void
    {
        // DealObserver writes to_stage_id as a string alongside to_stage_name;
        // DealAutomationService writes it as an int alongside to_stage.
        $this->deal(1);
        $this->stageEvent(1, from: null, to: '10', at: now()->subDays(20), nameKey: 'to_stage_name');
        $this->stageEvent(1, from: '10', to: 20, at: now()->subDays(18));

        $this->deal(2);
        $this->stageEvent(2, from: null, to: 10, at: now()->subDays(20), nameKey: 'to_stage');
        $this->stageEvent(2, from: 10, to: 20, at: now()->subDays(14));

        $dwell = $this->dwell();

        $this->assertSame(
            2,
            $dwell[10]['samples'],
            'The two metadata shapes were bucketed separately',
        );

        // Dwells are 2 and 6 days. The median here is nearest-rank, not
        // interpolated, so it returns the lower of the two middle values (2)
        // rather than their average (4) — see percentile(): every figure this
        // service reports is a duration that actually occurred.
        $this->assertSame(2.0, $dwell[10]['median_days']);
    }

    public function test_an_open_dwell_never_enters_the_closed_median(): void
    {
        // A deal parked in stage 10 for 100 days, with no exit event.
        $this->deal(1, stageId: 10, enteredAt: now()->subDays(100));

        $dwell = $this->dwell();

        $this->assertNull(
            $dwell[10]['median_days'],
            'A censored dwell was counted as a completed one',
        );
        $this->assertSame(0, $dwell[10]['samples']);
        $this->assertSame(1, $dwell[10]['open_count']);
        $this->assertSame(100.0, $dwell[10]['open_median_days']);
    }

    public function test_a_closed_deal_contributes_no_open_dwell(): void
    {
        $this->deal(1, stageId: 10, enteredAt: now()->subDays(50), outcome: 'won');

        $this->assertSame([], $this->dwell());
    }

    public function test_the_final_event_opens_a_dwell_that_is_not_yet_closed(): void
    {
        $this->deal(1);
        $this->stageEvent(1, from: null, to: 10, at: now()->subDays(9));
        $this->stageEvent(1, from: 10, to: 20, at: now()->subDays(6));

        $dwell = $this->dwell();

        // Stage 10 closed when the deal moved on; stage 20 has not closed, so
        // it contributes nothing to the closed median.
        $this->assertSame(3.0, $dwell[10]['median_days']);
        $this->assertArrayNotHasKey(20, $dwell);
    }

    public function test_deals_outside_the_agent_scope_are_ignored(): void
    {
        $this->deal(1, agentId: 99, stageId: 10, enteredAt: now()->subDays(30));

        $this->assertSame([], $this->dwell());
    }

    /** @return array<int, array<string, mixed>> */
    private function dwell(): array
    {
        return app(DashboardMetricsService::class)
            ->medianDaysInStage([$this->agentId]);
    }

    private function deal(
        int $id,
        ?int $stageId = null,
        $enteredAt = null,
        ?string $outcome = null,
        ?int $agentId = null,
    ): void {
        DB::table('deals')->insert([
            'id' => $id,
            'company_id' => $this->companyId,
            'name' => "Deal {$id}",
            'agent_id' => $agentId ?? $this->agentId,
            'pipeline_stage_id' => $stageId,
            'stage_entered_at' => $enteredAt,
            'outcome_status' => $outcome,
            'created_at' => now()->subDays(60),
            'updated_at' => now(),
        ]);
    }

    private function stageEvent(
        int $dealId,
        int|string|null $from,
        int|string $to,
        $at,
        string $nameKey = 'to_stage_name',
    ): void {
        DB::table('crm_events')->insert([
            'id' => $this->eventId++,
            'company_id' => $this->companyId,
            'event_type_id' => 1,
            'model_type' => Deal::class,
            'model_id' => $dealId,
            'metadata' => json_encode(array_filter([
                'from_stage_id' => $from,
                'to_stage_id' => $to,
                $nameKey => 'Some Stage',
            ], fn ($v) => ! is_null($v))),
            'occurred_at' => $at,
        ]);
    }

    private function resetSchema(): void
    {
        foreach (['crm_events', 'crm_event_types', 'deals', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->dateTime('stage_entered_at')->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamps();
        });

        Schema::create('crm_event_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('slug');
        });

        Schema::create('crm_events', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('event_type_id');
            $table->string('model_type');
            $table->unsignedInteger('model_id');
            $table->text('metadata')->nullable();
            $table->dateTime('occurred_at');
        });

        DB::table('companies')->insert(['id' => $this->companyId, 'company_name' => 'Test']);
        DB::table('crm_event_types')->insert(['id' => 1, 'slug' => 'deal_stage_changed']);
    }
}
