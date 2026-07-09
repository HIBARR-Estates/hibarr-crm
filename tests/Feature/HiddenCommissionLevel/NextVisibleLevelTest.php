<?php

namespace Tests\Feature\HiddenCommissionLevel;

use App\Models\LeadAgent;
use App\Services\LevelService;
use Tests\HiddenCommissionLevelTestCase;

class NextVisibleLevelTest extends HiddenCommissionLevelTestCase
{
    public function test_get_next_visible_level_skips_hidden_levels_in_chain(): void
    {
        $companyId = $this->seedCompany();
        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $this->seedLevel($companyId, 'Owner', 2, 8, ['is_hidden' => true]);
        $silverId = $this->seedLevel($companyId, 'Silver', 3, 5);

        $service = app(LevelService::class);

        $nextFromBronze = $service->getNextVisibleLevel($companyId, 1);
        $this->assertNotNull($nextFromBronze);
        $this->assertSame($silverId, $nextFromBronze->id);

        $nextFromHidden = $service->getNextVisibleLevel($companyId, 2);
        $this->assertNotNull($nextFromHidden);
        $this->assertSame($silverId, $nextFromHidden->id);

        $nextFromSilver = $service->getNextVisibleLevel($companyId, 3);
        $this->assertNull($nextFromSilver);

        $highestVisible = $service->getHighestVisibleLevel($companyId);
        $this->assertNotNull($highestVisible);
        $this->assertSame($silverId, $highestVisible->id);

        $this->assertSame($bronzeId, $service->getNextVisibleLevel($companyId, -1)?->id);
    }

    public function test_admin_dashboard_next_level_null_on_highest_visible(): void
    {
        $companyId = $this->seedCompany();
        $this->seedLevel($companyId, 'Bronze', 1, 2);
        $goldId = $this->seedLevel($companyId, 'Gold', 2, 6);
        $this->seedLevel($companyId, 'Owner', 3, 10, ['is_hidden' => true]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $goldId);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $service = app(LevelService::class);
        $currentLevel = $service->getCurrentLevel($agent);

        $this->assertSame($goldId, $currentLevel->id);
        $this->assertNull($service->getNextVisibleLevel($companyId, $currentLevel->rank));
    }
}
