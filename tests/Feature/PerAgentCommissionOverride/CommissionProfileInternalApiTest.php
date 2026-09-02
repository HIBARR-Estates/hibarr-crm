<?php



namespace Tests\Feature\PerAgentCommissionOverride;



use Tests\Concerns\SetsFeatureFlags;

use Tests\PerAgentCommissionOverrideTestCase;



class CommissionProfileInternalApiTest extends PerAgentCommissionOverrideTestCase

{

    use SetsFeatureFlags;

    public function test_returns_404_when_feature_flag_off(): void

    {

        $this->setFeatureFlag('sales.per-agent-commission-override', false);



        $companyId = $this->seedCompany();

        $this->seedApiToken($companyId);



        $userId = $this->seedUser($companyId);

        $agentId = $this->seedAgent($companyId, $userId);



        $response = $this->getJson("/api/v1/internal/agents/{$agentId}/commission-profile", [

            'X-API-TOKEN' => 'test-token',

            'X-COMPANY-ID' => (string) $companyId,

        ]);



        $response->assertStatus(404);

    }



    public function test_get_profile_when_flag_on(): void

    {

        $this->setFeatureFlag('sales.per-agent-commission-override', true);



        $companyId = $this->seedCompany();

        $this->seedMlmSettings($companyId, 10);

        $this->seedApiToken($companyId);



        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [

            'direct_rate' => 2,

            'override_rate' => 2,

        ]);

        $this->seedLevel($companyId, 'Silver', 2, 5, [

            'direct_rate' => 5,

            'override_rate' => 6,

        ]);



        $userId = $this->seedUser($companyId);

        $agentId = $this->seedAgent($companyId, $userId, null, [

            'custom_direct_rate' => 3,

            'custom_override_rate' => 3,

        ]);

        $this->seedLevelHistory($companyId, $agentId, $levelId);



        $response = $this->getJson("/api/v1/internal/agents/{$agentId}/commission-profile", [

            'X-API-TOKEN' => 'test-token',

            'X-COMPANY-ID' => (string) $companyId,

        ]);



        $response->assertOk()

            ->assertJsonPath('status', 'success')

            ->assertJsonPath('data.custom_commission_rate', 3)

            ->assertJsonPath('data.bounds.max_ceiling', 5)

            ->assertJsonMissingPath('data.custom_direct_rate')

            ->assertJsonMissingPath('data.custom_override_rate');

    }



    public function test_patch_sets_both_internal_rates_from_unified_field(): void

    {

        $this->setFeatureFlag('sales.per-agent-commission-override', true);



        $companyId = $this->seedCompany();

        $this->seedMlmSettings($companyId, 10);

        $this->seedApiToken($companyId);



        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [

            'direct_rate' => 2,

            'override_rate' => 2,

        ]);

        $this->seedLevel($companyId, 'Silver', 2, 5, [

            'direct_rate' => 5,

            'override_rate' => 6,

        ]);



        $userId = $this->seedUser($companyId);

        $agentId = $this->seedAgent($companyId, $userId);

        $this->seedLevelHistory($companyId, $agentId, $levelId);



        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/commission-profile", [

            'custom_commission_rate' => 4,

            'reason' => 'OL adjustment',

        ], [

            'X-API-TOKEN' => 'test-token',

            'X-COMPANY-ID' => (string) $companyId,

        ]);



        $response->assertOk()

            ->assertJsonPath('data.custom_commission_rate', 4);



        $agent = \App\Models\LeadAgent::withoutGlobalScopes()->findOrFail($agentId);

        $this->assertSame(4.0, (float) $agent->custom_direct_rate);

        $this->assertSame(4.0, (float) $agent->custom_override_rate);

    }



    public function test_patch_returns_422_on_bound_violation(): void

    {

        $this->setFeatureFlag('sales.per-agent-commission-override', true);



        $companyId = $this->seedCompany();

        $this->seedMlmSettings($companyId, 10);

        $this->seedApiToken($companyId);



        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [

            'direct_rate' => 2,

            'override_rate' => 2,

        ]);

        $this->seedLevel($companyId, 'Silver', 2, 5, [

            'direct_rate' => 5,

            'override_rate' => 6,

        ]);



        $userId = $this->seedUser($companyId);

        $agentId = $this->seedAgent($companyId, $userId);

        $this->seedLevelHistory($companyId, $agentId, $levelId);



        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/commission-profile", [

            'custom_commission_rate' => 6,

        ], [

            'X-API-TOKEN' => 'test-token',

            'X-COMPANY-ID' => (string) $companyId,

        ]);



        $response->assertStatus(422)

            ->assertJsonPath('status', 'fail')

            ->assertJsonStructure(['errors' => ['custom_commission_rate']]);

    }

    public function test_patch_stamps_changed_by_user_id_on_audit_log(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $this->seedApiToken($companyId);

        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);

        $agentUserId = $this->seedUser($companyId);
        $actorId = $this->seedUser($companyId, 'OL Admin');
        $agentId = $this->seedAgent($companyId, $agentUserId);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/commission-profile", [
            'custom_commission_rate' => 4,
            'reason' => 'OL adjustment',
            'changed_by_user_id' => $actorId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.custom_commission_rate', 4)
            ->assertJsonPath('data.audit.data.0.changed_by_user_id', $actorId)
            ->assertJsonPath('data.audit.data.0.changed_by_user.id', $actorId)
            ->assertJsonPath('data.audit.data.0.changed_by_user.name', 'OL Admin');

        $this->assertSame(
            $actorId,
            (int) \App\Models\AgentCommissionRateAuditLog::firstOrFail()->changed_by_user_id
        );
    }

    public function test_patch_omitting_changed_by_user_id_keeps_audit_actor_null(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $this->seedApiToken($companyId);

        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);

        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/commission-profile", [
            'custom_commission_rate' => 4,
            'reason' => 'OL adjustment',
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.audit.data.0.changed_by_user_id', null)
            ->assertJsonPath('data.audit.data.0.changed_by_user', null);
    }

    public function test_patch_rejects_changed_by_user_id_from_another_company(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $otherCompanyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);
        $this->seedApiToken($companyId);

        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 2, [
            'direct_rate' => 2,
            'override_rate' => 2,
        ]);
        $this->seedLevel($companyId, 'Silver', 2, 5, [
            'direct_rate' => 5,
            'override_rate' => 6,
        ]);

        $userId = $this->seedUser($companyId);
        $foreignUserId = $this->seedUser($otherCompanyId, 'Foreign Admin');
        $agentId = $this->seedAgent($companyId, $userId);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        $response = $this->patchJson("/api/v1/internal/agents/{$agentId}/commission-profile", [
            'custom_commission_rate' => 4,
            'changed_by_user_id' => $foreignUserId,
        ], [
            'X-API-TOKEN' => 'test-token',
            'X-COMPANY-ID' => (string) $companyId,
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['error' => ['details' => ['changed_by_user_id']]]);

        $this->assertNull(\App\Models\AgentCommissionRateAuditLog::first());
    }

}


