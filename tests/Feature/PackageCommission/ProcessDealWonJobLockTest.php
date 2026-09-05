<?php

namespace Tests\Feature\PackageCommission;

use App\Jobs\ProcessDealWonJob;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\CycleService;
use App\Services\HierarchyService;
use App\Services\LevelService;
use App\Services\MetricsService;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\PackageCommissionTestCase;

/**
 * ProcessDealWonJob's own lock write — the thing this session's request was
 * actually about. Winning must set commission_locked, must NOT touch
 * is_locked, and the idempotency guard must key off commission_locked, not
 * is_locked (an unrelated lock_deal action could set is_locked=true before
 * this job ever runs, and treating that as "already processed" would skip
 * commission distribution silently).
 *
 * LevelService/CycleService/HierarchyService are faked: their real
 * implementations reach into cycle/hierarchy tables this minimal schema
 * doesn't model, and none of that is what's under test here — only the
 * job's own lock-field bookkeeping is.
 */
class ProcessDealWonJobLockTest extends PackageCommissionTestCase
{
    /** @return array{company: int, agent: int, deal: int} */
    private function seedWonDeal(float $value = 1000): array
    {
        // Matches Bronze's own 5% exactly, so there is no remainder left for
        // a system leg — the test only cares about the count of legs
        // ProcessDealWonJob writes, not the differential split.
        Config::set('mlm.max_commission_percentage', 5);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 5);

        $bronze = $this->seedLevel($companyId, 'Bronze', 1, 5);
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));
        $this->seedLevelHistory($companyId, $agentId, $bronze);

        $dealId = $this->seedDeal($companyId, $agentId, $value);
        DB::table('deals')->where('id', $dealId)->update(['outcome_status' => 'won']);

        return ['company' => $companyId, 'agent' => $agentId, 'deal' => $dealId];
    }

    private function runJob(int $dealId): void
    {
        $deal = Deal::withoutGlobalScopes()->findOrFail($dealId);

        $metrics = Mockery::mock(MetricsService::class);
        $metrics->shouldReceive('incrementOnDealWon')->andReturnNull();

        $levels = Mockery::mock(LevelService::class);
        $levels->shouldReceive('evaluateWithAncestors')->andReturnNull();
        $levels->shouldReceive('getCurrentLevel')->andReturnNull();

        $cycles = Mockery::mock(CycleService::class);
        $cycles->shouldReceive('getActiveEnrollment')->andReturnNull();

        $hierarchy = Mockery::mock(HierarchyService::class);
        $hierarchy->shouldReceive('getAncestors')->andReturn(collect());
        // Also called by MlmCommissionService (constructor-injected with the
        // same container binding) for the upline differential — no upline in
        // this test's data either way.
        $hierarchy->shouldReceive('getAncestorsWithLevels')->andReturn(collect());
        $this->app->instance(HierarchyService::class, $hierarchy);

        (new ProcessDealWonJob($deal))->handle(
            $metrics,
            $levels,
            app(MlmCommissionService::class),
            $cycles,
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_winning_sets_commission_locked_and_leaves_is_locked_alone(): void
    {
        $ctx = $this->seedWonDeal();

        $this->runJob($ctx['deal']);

        $deal = Deal::withoutGlobalScopes()->findOrFail($ctx['deal']);
        $this->assertTrue((bool) $deal->commission_locked, 'Commission distribution must lock the value.');
        $this->assertNotNull($deal->commission_locked_at);
        $this->assertFalse(
            (bool) $deal->is_locked,
            'Winning must not lock the whole deal on its own — see Deal::isLocked().'
        );
    }

    public function test_idempotency_guard_keys_on_commission_locked_not_is_locked(): void
    {
        $ctx = $this->seedWonDeal();

        // Simulates a lock_deal automation action that ran in the same
        // request as the win, before this queued job got a chance to
        // execute — is_locked is true, but no commission exists yet.
        DB::table('deals')->where('id', $ctx['deal'])->update(['is_locked' => 1]);

        $this->runJob($ctx['deal']);

        $this->assertCount(
            1,
            MlmCommission::where('deal_id', $ctx['deal'])->get(),
            'is_locked being true for an unrelated reason must not make the job think commission already ran.'
        );
    }

    public function test_a_second_run_after_commission_locked_is_a_no_op(): void
    {
        $ctx = $this->seedWonDeal();

        $this->runJob($ctx['deal']);
        $firstRunCount = MlmCommission::where('deal_id', $ctx['deal'])->count();

        $this->runJob($ctx['deal']);
        $secondRunCount = MlmCommission::where('deal_id', $ctx['deal'])->count();

        $this->assertSame(1, $firstRunCount);
        $this->assertSame($firstRunCount, $secondRunCount, 'commission_locked must prevent a second distribution.');
    }
}
