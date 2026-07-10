<?php

namespace Tests\Feature\HiddenCommissionLevel;

use App\Http\Controllers\MlmAgentController;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use ReflectionMethod;
use Tests\HiddenCommissionLevelTestCase;

class AgentFacingMaskingTest extends HiddenCommissionLevelTestCase
{
    public function test_agent_dashboard_masks_hidden_current_level_as_null(): void
    {
        $companyId = $this->seedCompany();
        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $ownerId = $this->seedLevel($companyId, 'Owner', 2, 10, ['is_hidden' => true]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $ownerId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $hiddenLevel = MlmLevel::findOrFail($ownerId);

        $maskMethod = new ReflectionMethod(MlmAgentController::class, 'maskAgentLevelResponse');
        $maskMethod->setAccessible(true);
        $controller = app(MlmAgentController::class);

        $stats = $maskMethod->invoke($controller, [
            'current_level' => $hiddenLevel,
            'next_level' => MlmLevel::findOrFail($bronzeId),
            'progress_percentage' => 75.0,
            'criteria_progress' => [['met' => true]],
        ]);

        $this->assertNull($stats['current_level']);
        $this->assertNull($stats['next_level']);
        $this->assertSame(0.0, $stats['progress_percentage']);
        $this->assertSame([], $stats['criteria_progress']);

        $visibleLevel = MlmLevel::findOrFail($bronzeId);
        $stats = $maskMethod->invoke($controller, [
            'current_level' => $visibleLevel,
            'next_level' => null,
            'progress_percentage' => 0,
            'criteria_progress' => [],
        ]);

        $this->assertIsArray($stats['current_level']);
        $this->assertArrayNotHasKey('is_hidden', $stats['current_level']);
        $this->assertSame('Bronze', $stats['current_level']['name']);
    }
}
