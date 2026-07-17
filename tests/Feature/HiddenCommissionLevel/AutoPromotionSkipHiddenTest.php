<?php

namespace Tests\Feature\HiddenCommissionLevel;

use App\Models\AgentLevelHistory;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\LevelService;
use Tests\HiddenCommissionLevelTestCase;

class AutoPromotionSkipHiddenTest extends HiddenCommissionLevelTestCase
{
    public function test_evaluate_does_not_promote_to_hidden_level(): void
    {
        $companyId = $this->seedCompany();

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $ownerId = $this->seedLevel($companyId, 'Owner', 2, 10, ['is_hidden' => true]);
        $silverId = $this->seedLevel($companyId, 'Silver', 3, 5);

        $this->seedCriterion($ownerId, 'nsa', 5);
        $this->seedCriterion($silverId, 'nsa', 100);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);
        $this->seedAgentMetrics($companyId, $agentId, ['nsa' => 10]);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $result = app(LevelService::class)->evaluate($agent);

        $this->assertNull($result);

        $currentLevelId = AgentLevelHistory::where('agent_id', $agentId)
            ->orderByDesc('id')
            ->value('level_id');

        $this->assertSame($bronzeId, (int) $currentLevelId);
        $this->assertTrue(MlmLevel::findOrFail($ownerId)->is_hidden);
    }

    public function test_evaluate_promotes_to_next_visible_when_qualifying(): void
    {
        $companyId = $this->seedCompany();

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $this->seedLevel($companyId, 'Owner', 2, 10, ['is_hidden' => true]);
        $silverId = $this->seedLevel($companyId, 'Silver', 3, 5);

        $ownerId = MlmLevel::where('company_id', $companyId)->where('name', 'Owner')->value('id');
        $this->seedCriterion($ownerId, 'nsa', 5);
        $this->seedCriterion($silverId, 'nsa', 10);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);
        $this->seedAgentMetrics($companyId, $agentId, ['nsa' => 15]);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $result = app(LevelService::class)->evaluate($agent);

        $this->assertNotNull($result);
        $this->assertSame($silverId, $result->id);

        $currentLevelId = AgentLevelHistory::where('agent_id', $agentId)
            ->orderByDesc('id')
            ->value('level_id');

        $this->assertSame($silverId, (int) $currentLevelId);
    }
}
