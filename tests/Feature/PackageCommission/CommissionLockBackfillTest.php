<?php

namespace Tests\Feature\PackageCommission;

use App\Models\Deal;
use Illuminate\Support\Facades\DB;
use Tests\PackageCommissionTestCase;

class CommissionLockBackfillTest extends PackageCommissionTestCase
{
    public function test_backfill_locks_deals_with_commissions_or_the_old_won_locked_contract(): void
    {
        $companyId = $this->seedCompany();
        $agentId = $this->seedAgent($companyId, $this->seedUser($companyId, 'Agent'));

        $withCommission = $this->seedDeal($companyId, $agentId, 1000);
        DB::table('deals')->where('id', $withCommission)->update([
            'outcome_status' => 'won',
            'is_locked' => 0,
            'commission_locked' => 0,
        ]);
        DB::table('mlm_commissions')->insert([
            'company_id' => $companyId,
            'deal_id' => $withCommission,
            'agent_id' => $agentId,
            'source_agent_id' => $agentId,
            'percentage' => 5,
            'amount' => 50,
            'type' => 'agent',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $wonAndLocked = $this->seedDeal($companyId, $agentId, 800);
        DB::table('deals')->where('id', $wonAndLocked)->update([
            'outcome_status' => 'won',
            'is_locked' => 1,
            'commission_locked' => 0,
        ]);

        $open = $this->seedDeal($companyId, $agentId, 500);
        DB::table('deals')->where('id', $open)->update([
            'outcome_status' => null,
            'is_locked' => 0,
            'commission_locked' => 0,
        ]);

        $migration = require database_path('migrations/2026_09_05_000001_backfill_commission_locked_on_deals.php');
        $migration->up();

        $this->assertTrue((bool) Deal::withoutGlobalScopes()->find($withCommission)->commission_locked);
        $this->assertTrue((bool) Deal::withoutGlobalScopes()->find($wonAndLocked)->commission_locked);
        $this->assertFalse((bool) Deal::withoutGlobalScopes()->find($open)->commission_locked);
    }
}
