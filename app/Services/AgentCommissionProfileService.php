<?php

namespace App\Services;

use App\Models\AgentCommissionRateAuditLog;
use App\Models\LeadAgent;
use App\Support\FeatureFlags;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AgentCommissionProfileService
{
    public function __construct(
        protected LevelService $levelService,
        protected CommissionRateBoundService $boundService
    ) {}

    public function getProfile(int $agentId, int $companyId, int $auditPerPage = 15): array
    {
        $agent = LeadAgent::where('company_id', $companyId)->findOrFail($agentId);
        $level = $this->levelService->getCurrentLevel($agent);
        $bounds = $this->boundService->resolveBounds($agent);

        return [
            'agent_id' => $agent->id,
            'level' => $level ? [
                'id' => $level->id,
                'name' => $level->name,
                'rank' => $level->rank,
                'default_commission_rate' => (float) $level->commission_percentage,
            ] : null,
            'custom_commission_rate' => $this->resolveUnifiedCustomRate($agent),
            'bounds' => [
                'max_ceiling' => $this->boundService->getEffectiveCeiling($agent),
                'is_highest_visible_level' => $bounds['isHighestVisibleLevel'],
            ],
            'audit' => $this->getAuditLogs($agentId, $companyId, $auditPerPage),
        ];
    }

    /**
     * @param  array{custom_commission_rate?: float|null, reason?: string|null}  $payload
     * @return array{profile: array, errors?: array<string, list<string>>}
     */
    public function updateProfile(int $agentId, int $companyId, ?int $userId, array $payload): array
    {
        $agent = LeadAgent::where('company_id', $companyId)->findOrFail($agentId);

        if (!array_key_exists('custom_commission_rate', $payload)) {
            return [
                'profile' => [],
                'errors' => [
                    'custom_commission_rate' => ['The custom commission rate field is required.'],
                ],
            ];
        }

        $unifiedRate = $payload['custom_commission_rate'];
        $directRate = $unifiedRate !== null ? (float) $unifiedRate : null;
        $overrideRate = $directRate;

        $errors = $this->boundService->validateUnifiedRate($agent, $directRate);

        if ($errors !== []) {
            return ['profile' => [], 'errors' => $errors];
        }

        DB::transaction(function () use ($agent, $userId, $payload, $directRate, $overrideRate) {
            $previousDirect = $agent->custom_direct_rate !== null
                ? (float) $agent->custom_direct_rate
                : null;
            $previousOverride = $agent->custom_override_rate !== null
                ? (float) $agent->custom_override_rate
                : null;
            $previousUnified = $this->resolveUnifiedCustomRate($agent);

            $agent->update([
                'custom_direct_rate' => $directRate,
                'custom_override_rate' => $overrideRate,
            ]);

            if (
                $previousDirect !== $directRate
                || $previousOverride !== $overrideRate
            ) {
                AgentCommissionRateAuditLog::create([
                    'company_id' => $agent->company_id,
                    'agent_id' => $agent->id,
                    'changed_by_user_id' => $userId,
                    'previous_direct_rate' => $previousDirect,
                    'new_direct_rate' => $directRate,
                    'previous_override_rate' => $previousOverride,
                    'new_override_rate' => $overrideRate,
                    'changed_at' => now(),
                    'reason' => $payload['reason'] ?? null,
                ]);

                $newUnified = $directRate;
                app(MlmNotificationService::class)->afterCommit(
                    fn () => app(MlmNotificationService::class)->notifyCommissionProfileChanged(
                        $agent->fresh(['user']),
                        $previousUnified,
                        $newUnified,
                        $payload['reason'] ?? null,
                        $userId,
                    )
                );
            }
        });

        return ['profile' => $this->getProfile($agentId, $companyId)];
    }

    public function clearCustomRatesOnPromotion(LeadAgent $agent, ?int $userId, ?string $reason = null): void
    {
        if ($agent->custom_direct_rate === null && $agent->custom_override_rate === null) {
            return;
        }

        DB::transaction(function () use ($agent, $userId, $reason) {
            $previousDirect = $agent->custom_direct_rate !== null
                ? (float) $agent->custom_direct_rate
                : null;
            $previousOverride = $agent->custom_override_rate !== null
                ? (float) $agent->custom_override_rate
                : null;

            $agent->update([
                'custom_direct_rate' => null,
                'custom_override_rate' => null,
            ]);

            AgentCommissionRateAuditLog::create([
                'company_id' => $agent->company_id,
                'agent_id' => $agent->id,
                'changed_by_user_id' => $userId,
                'previous_direct_rate' => $previousDirect,
                'new_direct_rate' => null,
                'previous_override_rate' => $previousOverride,
                'new_override_rate' => null,
                'changed_at' => now(),
                'reason' => $reason ?? 'Custom rates cleared on level promotion',
            ]);
        });
    }

    public function resolveUnifiedCustomRate(LeadAgent $agent): ?float
    {
        $direct = $agent->custom_direct_rate;
        $override = $agent->custom_override_rate;

        if ($direct === null && $override === null) {
            return null;
        }

        if ($direct !== null && $override !== null) {
            return (float) $direct;
        }

        return (float) ($direct ?? $override);
    }

    /**
     * Swap a dashboard payload's current level commission percentage for the
     * agent's unified custom rate, so agent-facing surfaces show the rate
     * they actually earn.
     */
    public function applyDisplayRateToStats(LeadAgent $agent, array $stats): array
    {
        if (! FeatureFlags::enabled('sales.per-agent-commission-override')) {
            return $stats;
        }

        $customRate = $this->resolveUnifiedCustomRate($agent);

        if ($customRate !== null && is_array($stats['current_level'] ?? null)) {
            $stats['current_level']['commission_percentage'] = $customRate;
        }

        return $stats;
    }

    protected function getAuditLogs(int $agentId, int $companyId, int $perPage): LengthAwarePaginator
    {
        return AgentCommissionRateAuditLog::where('company_id', $companyId)
            ->where('agent_id', $agentId)
            ->with([
                'changedByUser' => fn ($query) => $query
                    ->select('id', 'name')
                    ->without(['session', 'clientContact']),
            ])
            ->orderByDesc('changed_at')
            ->paginate($perPage);
    }
}
