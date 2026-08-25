<?php

namespace Tests\Feature\PerAgentCommissionOverride;

use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\AgentCommissionProfileService;
use Illuminate\Support\Facades\App;
use Tests\Concerns\SetsFeatureFlags;
use Tests\PerAgentCommissionOverrideTestCase;

class DashboardCommissionOverrideTest extends PerAgentCommissionOverrideTestCase
{
    use SetsFeatureFlags;

    public function test_shows_override_rate_instead_of_level_percentage(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        [$agent, $level] = $this->seedAgentWithLevel(6.5);

        // Agent-facing payloads arrive pre-serialized as arrays.
        $stats = $this->applyDisplayRate($agent, ['current_level' => $level->toArray()]);

        $this->assertIsArray($stats['current_level']);
        $this->assertSame(6.5, $stats['current_level']['commission_percentage']);
    }

    public function test_keeps_level_percentage_when_no_override_set(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        [$agent, $level] = $this->seedAgentWithLevel(null);

        $stats = $this->applyDisplayRate($agent, ['current_level' => $level->toArray()]);

        $this->assertIsArray($stats['current_level']);
        $this->assertSame(3.0, (float) $stats['current_level']['commission_percentage']);
    }

    public function test_ignores_override_when_feature_flag_disabled(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', false);

        [$agent, $level] = $this->seedAgentWithLevel(6.5);

        $stats = $this->applyDisplayRate($agent, ['current_level' => $level->toArray()]);

        $this->assertIsArray($stats['current_level']);
        $this->assertSame(3.0, (float) $stats['current_level']['commission_percentage']);
    }

    public function test_handles_null_current_level_with_override_set(): void
    {
        $this->setFeatureFlag('sales.per-agent-commission-override', true);

        [$agent] = $this->seedAgentWithLevel(6.5);

        $stats = $this->applyDisplayRate($agent, ['current_level' => null]);

        $this->assertNull($stats['current_level']);
    }

    /**
     * @return array{0: LeadAgent, 1: MlmLevel}
     */
    private function seedAgentWithLevel(?float $customRate): array
    {
        $companyId = $this->seedCompany();
        $levelId = $this->seedLevel($companyId, 'Bronze', 1, 3);
        $userId = $this->seedUser($companyId);

        $extra = $customRate === null ? [] : [
            'custom_direct_rate' => $customRate,
            'custom_override_rate' => $customRate,
        ];

        $agentId = $this->seedAgent($companyId, $userId, null, $extra);
        $this->seedLevelHistory($companyId, $agentId, $levelId);

        return [
            LeadAgent::withoutGlobalScopes()->findOrFail($agentId),
            MlmLevel::findOrFail($levelId),
        ];
    }

    /**
     * @param  array<string, mixed>  $stats
     */
    private function applyDisplayRate(LeadAgent $agent, array $stats): array
    {
        return App::make(AgentCommissionProfileService::class)
            ->applyDisplayRateToStats($agent, $stats);
    }
}
