<?php

namespace Tests\Feature\PerAgentCommissionOverride;

use App\Models\AgentCommissionRateAuditLog;
use App\Models\LeadAgent;
use App\Services\AgentCommissionProfileService;
use Tests\Concerns\SetsFeatureFlags;
use Tests\PerAgentCommissionOverrideTestCase;

class CommissionRateAuditTest extends PerAgentCommissionOverrideTestCase
{
    use SetsFeatureFlags;

    public function test_update_profile_creates_audit_log(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $this->seedMlmSettings($companyId, 10);

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

        $service = app(AgentCommissionProfileService::class);
        $result = $service->updateProfile($agentId, $companyId, $userId, [
            'custom_commission_rate' => 3,
            'reason' => 'Special arrangement',
        ]);

        $this->assertEmpty($result['errors'] ?? []);

        $agent = LeadAgent::withoutGlobalScopes()->findOrFail($agentId);
        $this->assertSame(3.0, (float) $agent->custom_direct_rate);
        $this->assertSame(3.0, (float) $agent->custom_override_rate);

        $audit = AgentCommissionRateAuditLog::first();
        $this->assertNotNull($audit);
        $this->assertSame($agentId, (int) $audit->agent_id);
        $this->assertNull($audit->previous_direct_rate);
        $this->assertSame('3.00', number_format((float) $audit->new_direct_rate, 2, '.', ''));
        $this->assertSame('Special arrangement', $audit->reason);
    }

    public function test_audit_log_is_immutable(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        $companyId = $this->seedCompany();
        $userId = $this->seedUser($companyId);
        $agentId = $this->seedAgent($companyId, $userId);

        $log = AgentCommissionRateAuditLog::create([
            'company_id' => $companyId,
            'agent_id' => $agentId,
            'changed_by_user_id' => $userId,
            'previous_direct_rate' => null,
            'new_direct_rate' => 3,
            'previous_override_rate' => null,
            'new_override_rate' => 4,
            'changed_at' => now(),
            'reason' => 'Test',
        ]);

        $this->expectException(\RuntimeException::class);
        $log->update(['reason' => 'Changed']);
    }
}
