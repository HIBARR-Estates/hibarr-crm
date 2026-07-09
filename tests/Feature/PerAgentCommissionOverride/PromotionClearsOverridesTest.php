<?php

namespace Tests\Feature\PerAgentCommissionOverride;

use App\Models\AgentCommissionRateAuditLog;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\LevelService;
use Tests\Concerns\SetsFeatureFlags;
use Tests\PerAgentCommissionOverrideTestCase;

class PromotionClearsOverridesTest extends PerAgentCommissionOverrideTestCase
{
    use SetsFeatureFlags;

    public function test_promotion_clears_custom_rates_when_flag_on(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 3,
            'custom_override_rate' => 4,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $silver = MlmLevel::findOrFail($silverId);

        app(LevelService::class)->assignLevel(
            $agent,
            $silver,
            assignedBy: $userId,
            systemAssigned: false
        );

        $agent->refresh();
        $this->assertNull($agent->custom_direct_rate);
        $this->assertNull($agent->custom_override_rate);

        $audit = AgentCommissionRateAuditLog::latest('id')->first();
        $this->assertNotNull($audit);
        $this->assertNull($audit->new_direct_rate);
        $this->assertNull($audit->new_override_rate);
        $this->assertStringContainsString('promotion', strtolower($audit->reason ?? ''));
    }

    public function test_promotion_does_not_clear_when_flag_off(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', false);

        $companyId = $this->seedCompany();
        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 3,
            'custom_override_rate' => 4,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $silver = MlmLevel::findOrFail($silverId);

        app(LevelService::class)->assignLevel(
            $agent,
            $silver,
            assignedBy: $userId,
            systemAssigned: false
        );

        $agent->refresh();
        $this->assertSame(3.0, (float) $agent->custom_direct_rate);
        $this->assertSame(4.0, (float) $agent->custom_override_rate);
        $this->assertSame(0, AgentCommissionRateAuditLog::count());
    }
}
