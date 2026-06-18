<?php

namespace App\Services;

use App\Models\AgentCommissionRateAuditLog;
use App\Models\LeadAgent;
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
                'direct_rate' => (float) $level->direct_rate,
                'override_rate' => (float) $level->override_rate,
                'commission_percentage' => (float) $level->commission_percentage,
            ] : null,
            'defaults' => $level ? [
                'direct_rate' => (float) $level->direct_rate,
                'override_rate' => (float) $level->override_rate,
            ] : null,
            'custom_direct_rate' => $agent->custom_direct_rate !== null
                ? (float) $agent->custom_direct_rate
                : null,
            'custom_override_rate' => $agent->custom_override_rate !== null
                ? (float) $agent->custom_override_rate
                : null,
            'bounds' => $bounds,
            'audit' => $this->getAuditLogs($agentId, $companyId, $auditPerPage),
        ];
    }

    /**
     * @param  array{custom_direct_rate?: float|null, custom_override_rate?: float|null, reason?: string|null}  $payload
     * @return array{profile: array, errors?: array<string, list<string>>}
     */
    public function updateProfile(int $agentId, int $companyId, ?int $userId, array $payload): array
    {
        $agent = LeadAgent::where('company_id', $companyId)->findOrFail($agentId);

        $directRate = array_key_exists('custom_direct_rate', $payload)
            ? $payload['custom_direct_rate']
            : $agent->custom_direct_rate;
        $overrideRate = array_key_exists('custom_override_rate', $payload)
            ? $payload['custom_override_rate']
            : $agent->custom_override_rate;

        $directRate = $directRate !== null ? (float) $directRate : null;
        $overrideRate = $overrideRate !== null ? (float) $overrideRate : null;

        $errors = $this->boundService->validateRates($agent, $directRate, $overrideRate);

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
