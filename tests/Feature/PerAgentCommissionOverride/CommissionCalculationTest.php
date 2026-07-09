<?php

namespace Tests\Feature\PerAgentCommissionOverride;

use App\Enums\MlmCommissionType;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\Config;
use Tests\Concerns\SetsFeatureFlags;
use Tests\PerAgentCommissionOverrideTestCase;

class CommissionCalculationTest extends PerAgentCommissionOverrideTestCase
{
    use SetsFeatureFlags;

    public function test_flag_off_uses_legacy_commission_percentage(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', false);
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 7,
            'custom_override_rate' => 8,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        $dealId = $this->seedDeal($companyId, $agentId, 1000);
        $deal = Deal::withoutGlobalScopes()->findOrFail($dealId);

        app(MlmCommissionService::class)->distribute($deal);

        $agentCommission = MlmCommission::where('deal_id', $dealId)
            ->where('type', MlmCommissionType::Agent->value)
            ->first();

        $this->assertNotNull($agentCommission);
        $this->assertSame(3.0, (float) $agentCommission->percentage);
        $this->assertSame(30.0, (float) $agentCommission->amount);
    }

    public function test_flag_on_uses_custom_direct_rate_for_agent(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 3, [
            'direct_rate' => 3,
            'override_rate' => 3,
        ]);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 4.5,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        $dealId = $this->seedDeal($companyId, $agentId, 1000);
        $deal = Deal::withoutGlobalScopes()->findOrFail($dealId);

        app(MlmCommissionService::class)->distribute($deal);

        $agentCommission = MlmCommission::where('deal_id', $dealId)
            ->where('type', MlmCommissionType::Agent->value)
            ->first();

        $this->assertSame(4.5, (float) $agentCommission->percentage);
        $this->assertSame(45.0, (float) $agentCommission->amount);
    }

    public function test_flag_on_upline_uses_override_rate_in_differential(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);
        Config::set('mlm.max_commission_percentage', 10);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $goldId = $this->seedLevel($companyId, 'Gold', 2, 7, [
            'direct_rate' => 7,
            'override_rate' => 8,
        ]);

        $uplineUserId = $this->seedUser($companyId, 'Upline Agent');
        $agentUserId = $this->seedUser($companyId, 'Closing Agent');

        $uplineId = $this->seedAgent($companyId, $uplineUserId);
        $agentId = $this->seedAgent($companyId, $agentUserId, $uplineId);

        $this->seedLevelHistory($companyId, $agentId, $bronzeId);
        $this->seedLevelHistory($companyId, $uplineId, $goldId);
        $this->seedHierarchyLink($uplineId, $agentId, 1);

        $dealId = $this->seedDeal($companyId, $agentId, 1000);
        $deal = Deal::withoutGlobalScopes()->findOrFail($dealId);

        app(MlmCommissionService::class)->distribute($deal);

        $uplineCommission = MlmCommission::where('deal_id', $dealId)
            ->where('type', MlmCommissionType::Upline->value)
            ->first();

        $this->assertNotNull($uplineCommission);
        $this->assertSame(6.0, (float) $uplineCommission->percentage);
        $this->assertSame(60.0, (float) $uplineCommission->amount);
    }
}
