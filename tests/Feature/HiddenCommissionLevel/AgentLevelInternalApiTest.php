<?php

namespace Tests\Feature\HiddenCommissionLevel;

use App\Http\Controllers\Api\CommissionLevelsInternalController;
use App\Models\LeadAgent;
use App\Services\LevelService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\HiddenCommissionLevelTestCase;

class AgentLevelInternalApiTest extends HiddenCommissionLevelTestCase
{
    use SetsFeatureFlags;
    public function test_get_levels_returns_all_levels_with_is_hidden_flag(): void
    {
        $companyId = $this->seedCompany();

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $ownerId = $this->seedLevel($companyId, 'Owner', 2, 10, ['is_hidden' => true]);

        $request = Request::create('/api/v1/internal/commissions/levels', 'GET');
        $request->headers->set('X-COMPANY-ID', (string) $companyId);

        $response = app(CommissionLevelsInternalController::class)->index($request);

        $this->assertSame(200, $response->getStatusCode());
        $payload = $response->getData(true);

        $this->assertSame('success', $payload['status']);
        $this->assertCount(2, $payload['data']);
        $this->assertSame($bronzeId, $payload['data'][0]['id']);
        $this->assertFalse($payload['data'][0]['isHidden']);
        $this->assertSame($ownerId, $payload['data'][1]['id']);
        $this->assertTrue($payload['data'][1]['isHidden']);
    }

    public function test_patch_rejects_hidden_level_with_level_hidden_error(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $ownerId = $this->seedLevel($companyId, 'Owner', 2, 10, ['is_hidden' => true]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $ownerId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error', 'LEVEL_HIDDEN')
            ->assertJsonPath('message', 'Hidden levels cannot be assigned through normal promotion flows.');

        $this->assertSame(
            $bronzeId,
            (int) DB::table('agent_level_history')->where('agent_id', $agentId)->orderByDesc('id')->value('level_id')
        );
    }

    public function test_patch_allows_visible_level_assignment(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'level_id' => $silverId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success')
            ->assertJsonPath('data.levelId', $silverId);

        $this->assertSame(
            $silverId,
            (int) DB::table('agent_level_history')->where('agent_id', $agentId)->orderByDesc('id')->value('level_id')
        );
    }

    public function test_returns_401_when_api_token_missing(): void
    {
        $companyId = $this->seedCompany();
        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $bronzeId,
        ], [
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(401);
    }

    public function test_returns_401_when_api_token_invalid(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
        ], [
            'X-API-TOKEN' => 'invalid-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(401);
    }

    public function test_returns_404_when_agent_not_found(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);

        $response = $this->patchJson('/api/v1/internal/agents/99999/level', [
            'levelId' => $bronzeId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('error', 'AGENT_NOT_FOUND')
            ->assertJsonPath('message', 'Agent not found.');
    }

    public function test_returns_404_when_level_not_found(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => 99999,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('error', 'LEVEL_NOT_FOUND')
            ->assertJsonPath('message', 'Commission level not found.');
    }

    public function test_returns_404_when_level_belongs_to_another_company(): void
    {
        $companyId = $this->seedCompany();
        $otherCompanyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $otherLevelId = $this->seedLevel($otherCompanyId, 'Silver', 2, 5);
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $otherLevelId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(404)
            ->assertJsonPath('error', 'LEVEL_NOT_FOUND');
    }

    public function test_patch_clears_custom_rates_on_promotion(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 3,
            'custom_override_rate' => 4,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk();

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $this->assertNull($agent->custom_direct_rate);
        $this->assertNull($agent->custom_override_rate);
    }

    public function test_patch_promotion_clears_custom_rates_with_actor(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $actorId = $this->seedUser($companyId, 'OL Admin');
        $agentId = $this->seedAgent($companyId, $userId, null, [
            'custom_direct_rate' => 3,
            'custom_override_rate' => 4,
        ]);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
            'changed_by_user_id' => $actorId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk();

        $this->assertSame(
            $actorId,
            (int) DB::table('agent_commission_rate_audit_logs')
                ->where('agent_id', $agentId)
                ->orderByDesc('id')
                ->value('changed_by_user_id')
        );
    }

    public function test_patch_does_not_trigger_auto_evaluation(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $levelService = Mockery::mock(LevelService::class)->makePartial();
        $levelService->shouldReceive('evaluate')->never();
        $this->app->instance(LevelService::class, $levelService);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.levelId', $silverId);

        $this->assertFalse(
            (bool) DB::table('agent_level_history')
                ->where('agent_id', $agentId)
                ->orderByDesc('id')
                ->value('system_assigned')
        );
    }

    public function test_patch_stamps_changed_by_user_id_as_assigned_by(): void
    {
        $companyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $actorId = $this->seedUser($companyId, 'OL Admin');
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
            'changed_by_user_id' => $actorId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.levelId', $silverId);

        $this->assertSame(
            $actorId,
            (int) DB::table('agent_level_history')
                ->where('agent_id', $agentId)
                ->orderByDesc('id')
                ->value('assigned_by')
        );
    }

    public function test_patch_rejects_changed_by_user_id_from_another_company(): void
    {
        $companyId = $this->seedCompany();
        $otherCompanyId = $this->seedCompany();
        $this->seedApiToken($companyId);

        $bronzeId = $this->seedLevel($companyId, 'Bronze', 1, 2);
        $silverId = $this->seedLevel($companyId, 'Silver', 2, 5);

        $userId = $this->seedUser($companyId);
        $foreignUserId = $this->seedUser($otherCompanyId, 'Foreign Admin');
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $bronzeId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/level", [
            'levelId' => $silverId,
            'changed_by_user_id' => $foreignUserId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['changed_by_user_id']]]);

        $this->assertSame(
            $bronzeId,
            (int) DB::table('agent_level_history')->where('agent_id', $agentId)->orderByDesc('id')->value('level_id')
        );
    }
}
