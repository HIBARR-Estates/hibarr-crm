<?php

namespace Tests\Unit;

use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\CommissionRateBoundService;
use App\Services\LevelService;
use Illuminate\Support\Facades\Config;
use Tests\PerAgentCommissionOverrideTestCase;

class CommissionRateBoundServiceTest extends PerAgentCommissionOverrideTestCase
{
    private CommissionRateBoundService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CommissionRateBoundService::class);
    }

    public function test_highest_visible_level_uses_max_commission_ceiling(): void
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 12.5);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $goldId = $this->seedLevel($companyId, 'Gold', 2, 8, [
            'direct_rate' => 8,
            'override_rate' => 9,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $goldId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $bounds = $this->service->resolveBounds($agent);

        $this->assertTrue($bounds['isHighestVisibleLevel']);
        $this->assertSame(12.5, $bounds['directCeiling']);
        $this->assertSame(12.5, $bounds['overrideCeiling']);
    }

    public function test_non_highest_level_uses_next_visible_level_rates(): void
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2.5,
        ]);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);
        $this->seedLevel($companyId, 'Gold', 3, 8, [
            'direct_rate' => 8,
            'override_rate' => 9,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $bounds = $this->service->resolveBounds($agent);

        $this->assertFalse($bounds['isHighestVisibleLevel']);
        $this->assertSame(5.0, $bounds['directCeiling']);
        $this->assertSame(6.0, $bounds['overrideCeiling']);
    }

    public function test_validate_rates_rejects_out_of_bounds(): void
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $errors = $this->service->validateRates($agent, 5.01, 6.01);

        $this->assertArrayHasKey('custom_direct_rate', $errors);
        $this->assertArrayHasKey('custom_override_rate', $errors);
    }

    public function test_hidden_levels_are_skipped_when_finding_next_visible(): void
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Hidden', 2, 4, [
            'direct_rate' => 4,
            'override_rate' => 4.5,
            'is_hidden' => true,
        ]);
        $this->seedLevel($companyId, 'Silver', 3, 6, [
            'direct_rate' => 6,
            'override_rate' => 7,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $bounds = $this->service->resolveBounds($agent);

        $this->assertSame(6.0, $bounds['directCeiling']);
        $this->assertSame(7.0, $bounds['overrideCeiling']);
    }

    public function test_validate_unified_rate_uses_effective_ceiling(): void
    {
        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);

        $this->assertSame(5.0, $this->service->getEffectiveCeiling($agent));
        $this->assertEmpty($this->service->validateUnifiedRate($agent, 5));
        $this->assertArrayHasKey(
            'custom_commission_rate',
            $this->service->validateUnifiedRate($agent, 5.01)
        );
    }
}
