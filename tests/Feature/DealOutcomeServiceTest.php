<?php

namespace Tests\Feature;

use App\Enums\MlmCommissionStatus;
use App\Enums\OutcomeStatus;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\Deal\DealOutcomeService;
use App\Services\MetricsService;
use App\Services\MlmCommissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * Manually changing a deal's outcome moves money: winning queues commission
 * payouts, un-winning reverses the pending ones. These cover the transitions
 * that have consequences, and the one that must NOT (paid commissions).
 */
class DealOutcomeServiceTest extends TestCase
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

        // DealObserver's saved() hook fans out into automations, CRM events and
        // notifications — a schema surface far wider than this test. Muted so
        // these cover DealOutcomeService's own contract: what it reverts, what it
        // preserves, and what it leaves alone. The observer's own behaviour
        // (firing DealWonEvent) is not asserted here.
        Deal::unsetEventDispatcher();
    }

    protected function tearDown(): void
    {
        Deal::setEventDispatcher($this->app['events']);
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_marking_won_stamps_won_at_and_reports_queued_commissions(): void
    {
        $deal = $this->makeDeal(['agent_id' => 7]);

        $result = $this->service()->apply($deal, OutcomeStatus::Won, 'test');

        $this->assertTrue($result['changed']);
        $this->assertSame('won', $result['to']);
        $this->assertTrue(
            $result['commissions_queued'],
            'Distribution is queued, so the caller must be told it has not happened yet.'
        );
        $this->assertNotNull($deal->fresh()->won_at);
    }

    public function test_marking_won_without_an_agent_does_not_claim_queued_commissions(): void
    {
        $deal = $this->makeDeal(['agent_id' => null]);

        $result = $this->service()->apply($deal, OutcomeStatus::Won, 'test');

        $this->assertFalse(
            $result['commissions_queued'],
            'With no agent there is nobody to pay — the UI must not promise a payout.'
        );
    }

    public function test_leaving_won_reverts_pending_commissions_and_commission_unlocks_the_deal(): void
    {
        $deal = $this->makeDeal([
            'outcome_status' => 'won',
            'commission_locked' => 1,
            'commission_locked_at' => '2026-08-01 10:00:01',
            'won_at' => '2026-08-01 10:00:00',
        ]);
        $this->makeCommission($deal->id, MlmCommissionStatus::Pending->value, 500);

        $result = $this->service()->apply($deal, OutcomeStatus::Lost, 'mistake');

        $this->assertSame(1, $result['reverted_commissions']);

        $fresh = $deal->fresh();
        $this->assertSame('lost', $fresh->outcome_status->value);
        $this->assertNull($fresh->won_at, 'A deal that is not won must not keep a won_at.');
        $this->assertFalse(
            (bool) $fresh->commission_locked,
            'Reverting must commission-unlock, or the value stays blocked despite no active commission left to protect.'
        );
        $this->assertNull($fresh->commission_locked_at);
    }

    /**
     * is_locked and commission_locked are independent: a deal locked for a
     * reason unrelated to commission (a lock_deal automation action, a manual
     * lock) must stay locked after an outcome revert — apply() does not own
     * that flag and must not touch it in either direction.
     */
    public function test_leaving_won_does_not_touch_is_locked_set_for_an_unrelated_reason(): void
    {
        $deal = $this->makeDeal([
            'outcome_status' => 'won',
            'is_locked' => 1,
            'locked_at' => '2026-07-01 09:00:00',
            'commission_locked' => 1,
        ]);
        $this->makeCommission($deal->id, MlmCommissionStatus::Pending->value, 500);

        $this->service()->apply($deal, OutcomeStatus::Lost, 'mistake');

        $fresh = $deal->fresh();
        $this->assertTrue((bool) $fresh->is_locked, 'is_locked belongs to something else and must survive an outcome revert untouched.');
        $this->assertFalse((bool) $fresh->commission_locked);
    }

    public function test_already_paid_commissions_are_kept_and_reported(): void
    {
        $deal = $this->makeDeal(['outcome_status' => 'won', 'is_locked' => 1]);
        $this->makeCommission($deal->id, MlmCommissionStatus::Paid->value, 900);
        $this->makeCommission($deal->id, MlmCommissionStatus::Pending->value, 100);

        $result = $this->service()->apply($deal, null, 'clearing');

        $this->assertSame(1, $result['reverted_commissions'], 'Only the pending one reverts.');
        $this->assertSame(1, $result['paid_commissions_kept']);

        $paid = MlmCommission::where('deal_id', $deal->id)
            ->where('amount', 900)
            ->first();

        $this->assertSame(
            MlmCommissionStatus::Paid->value,
            $paid->status->value ?? $paid->status,
            'Money already paid out must never be silently reversed.'
        );
    }

    public function test_no_op_when_the_outcome_is_unchanged(): void
    {
        $deal = $this->makeDeal(['outcome_status' => 'won', 'is_locked' => 1]);
        $this->makeCommission($deal->id, MlmCommissionStatus::Pending->value, 500);

        $result = $this->service()->apply($deal, OutcomeStatus::Won, 'again');

        $this->assertFalse($result['changed']);
        $this->assertSame(0, $result['reverted_commissions'], 'A no-op must not touch commissions.');
        $this->assertTrue((bool) $deal->fresh()->is_locked);
    }

    public function test_lost_to_null_never_touches_commissions(): void
    {
        $deal = $this->makeDeal(['outcome_status' => 'lost']);
        $this->makeCommission($deal->id, MlmCommissionStatus::Pending->value, 500);

        $result = $this->service()->apply($deal, null, 'clearing');

        $this->assertTrue($result['changed']);
        $this->assertSame(
            0,
            $result['reverted_commissions'],
            'Only leaving *won* has MLM consequences.'
        );
    }

    private function service(): DealOutcomeService
    {
        // MetricsService reaches into cycles/hierarchy that this minimal schema
        // does not model; the reversal contract under test is "it is called".
        $metrics = Mockery::mock(MetricsService::class);
        $metrics->shouldReceive('decrementOnDealReverted')->andReturnNull();

        // Real commission service (its revert() is what's under test); the
        // container supplies its four collaborators, none of which touch the DB
        // at construction.
        return new DealOutcomeService(app(MlmCommissionService::class), $metrics);
    }

    private function makeDeal(array $attributes = []): Deal
    {
        $id = DB::table('deals')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Test Deal',
            'value' => 1000,
            'agent_id' => 7,
            'outcome_status' => null,
            'won_at' => null,
            'is_locked' => 0,
            'locked_at' => null,
            'commission_locked' => 0,
            'commission_locked_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));

        return Deal::withoutGlobalScopes()->findOrFail($id);
    }

    private function makeCommission(int $dealId, string $status, float $amount): void
    {
        DB::table('mlm_commissions')->insert([
            'company_id' => $this->companyId,
            'deal_id' => $dealId,
            'agent_id' => 7,
            'percentage' => 10,
            'amount' => $amount,
            'type' => 'agent',
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createMinimalSchema(): void
    {
        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->decimal('value', 20, 2)->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->string('outcome_status')->nullable();
            $table->timestamp('won_at')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->timestamp('locked_at')->nullable();
            $table->boolean('commission_locked')->default(false);
            $table->timestamp('commission_locked_at')->nullable();
            // Written by DealObserver::saving() on every save — kept here so the
            // observer stays live rather than being disabled for the test.
            $table->string('next_follow_up')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->unsignedBigInteger('pipeline_stage_id')->nullable();
            $table->timestamp('stage_entered_at')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->double('exchange_rate')->nullable();
            $table->timestamps();
        });

        Schema::create('mlm_commissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('deal_id');
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('source_agent_id')->nullable();
            $table->unsignedBigInteger('level_id')->nullable();
            $table->unsignedBigInteger('cycle_level_snapshot_id')->nullable();
            $table->decimal('percentage', 5, 2)->nullable();
            $table->decimal('amount', 15, 2)->default(0);
            $table->string('type')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->string('reverted_reason')->nullable();
            $table->timestamps();
        });
    }

    private function resetSchema(): void
    {
        foreach (['mlm_commissions', 'deals'] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
