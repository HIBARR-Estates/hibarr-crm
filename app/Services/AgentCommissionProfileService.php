<?php

namespace App\Services;

use App\Enums\PackageCommissionType;
use App\Models\AgentCommissionRateAuditLog;
use App\Models\LeadAgent;
use App\Support\CommissionTerms;
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
        $overrideEnabled = FeatureFlags::enabled('sales.per-agent-commission-override');

        return [
            'agent_id' => $agent->id,
            'level' => $level ? [
                'id' => $level->id,
                'name' => $level->name,
                'rank' => $level->rank,
                'default_commission_rate' => (float) $level->commission_percentage,
            ] : null,
            // With per-agent overrides off, only the referral share is served: the
            // saved override rate and its history stay out of the payload.
            'custom_commission_rate' => $overrideEnabled ? $this->resolveUnifiedCustomRate($agent) : null,
            // What the partner earns on a referred deal that has no package, taken
            // from the deal value. Per-package terms are edited on the package.
            'referral_commission_type' => FeatureFlags::enabled('crm.partner-referral-commission')
                ? $agent->referral_commission_type?->value
                : null,
            'referral_commission_value' => FeatureFlags::enabled('crm.partner-referral-commission')
                && $agent->referral_commission_value !== null
                ? (float) $agent->referral_commission_value
                : null,
            'is_partner' => (bool) $agent->is_partner && FeatureFlags::enabled('crm.partner-referral-commission'),
            'bounds' => [
                'max_ceiling' => $this->boundService->getEffectiveCeiling($agent),
                'is_highest_visible_level' => $bounds['isHighestVisibleLevel'],
            ],
            'audit' => $this->getAuditLogs($agentId, $companyId, $auditPerPage, $overrideEnabled),
        ];
    }

    /**
     * @param  array{custom_commission_rate?: float|null, reason?: string|null, changed_by_user_id?: int|null}  $payload
     * @return array{profile: array, errors?: array<string, list<string>>}
     */
    public function updateProfile(int $agentId, int $companyId, ?int $userId, array $payload): array
    {
        $agent = LeadAgent::where('company_id', $companyId)->findOrFail($agentId);

        $hasCustom = array_key_exists('custom_commission_rate', $payload);
        $hasReferral = array_key_exists('referral_commission_type', $payload)
            && FeatureFlags::enabled('crm.partner-referral-commission');

        if (! $hasCustom && ! $hasReferral) {
            return [
                'profile' => [],
                'errors' => [
                    'custom_commission_rate' => ['The custom commission rate field is required.'],
                ],
            ];
        }

        $directRate = null;
        $overrideRate = null;

        if ($hasCustom) {
            $unifiedRate = $payload['custom_commission_rate'];
            $directRate = $unifiedRate !== null ? (float) $unifiedRate : null;
            $overrideRate = $directRate;

            $errors = $this->boundService->validateUnifiedRate($agent, $directRate);

            if ($errors !== []) {
                return ['profile' => [], 'errors' => $errors];
            }
        }

        $referralTerms = null;

        if ($hasReferral) {
            if (! $agent->is_partner) {
                return [
                    'profile' => [],
                    'errors' => [
                        'referral_commission_type' => ['Referral commission can only be set on a partner.'],
                    ],
                ];
            }

            $type = $payload['referral_commission_type'] ?: null;
            $value = $payload['referral_commission_value'] ?? null;

            if ($type !== null && ! in_array($type, PackageCommissionType::toArray(), true)) {
                return [
                    'profile' => [],
                    'errors' => ['referral_commission_type' => ['Choose percentage, fixed or none.']],
                ];
            }

            // "None" and no terms pay the same on a partner, so both are stored as no terms.
            $referralTerms = CommissionTerms::make($type, $value);

            if ($type !== null && $type !== PackageCommissionType::None->value && $referralTerms === null) {
                return [
                    'profile' => [],
                    'errors' => ['referral_commission_value' => ['Enter the referral amount or percentage.']],
                ];
            }

            if ($referralTerms !== null && $referralTerms->isPercentage() && ($referralTerms->value < 0 || $referralTerms->value > 100)) {
                return [
                    'profile' => [],
                    'errors' => ['referral_commission_value' => ['Referral percentage must be between 0 and 100.']],
                ];
            }

            if ($referralTerms !== null && $referralTerms->isNone()) {
                $referralTerms = null;
            }
        }

        DB::transaction(function () use ($agentId, $companyId, $userId, $payload, $hasCustom, $hasReferral, $directRate, $overrideRate, $referralTerms) {
            // Read the previous rates under a row lock so two concurrent saves
            // cannot both audit the same "previous" value.
            $agent = LeadAgent::where('company_id', $companyId)->lockForUpdate()->findOrFail($agentId);

            $previousDirect = $agent->custom_direct_rate !== null
                ? (float) $agent->custom_direct_rate
                : null;
            $previousOverride = $agent->custom_override_rate !== null
                ? (float) $agent->custom_override_rate
                : null;
            $previousUnified = $this->resolveUnifiedCustomRate($agent);
            $previousReferral = CommissionTerms::make($agent->referral_commission_type, $agent->referral_commission_value);

            $updates = [];

            if ($hasCustom) {
                $updates['custom_direct_rate'] = $directRate;
                $updates['custom_override_rate'] = $overrideRate;
            }

            if ($hasReferral) {
                $updates['referral_commission_type'] = $referralTerms?->type->value;
                $updates['referral_commission_value'] = $referralTerms?->value;
            }

            if ($updates !== []) {
                $agent->update($updates);
            }

            $customChanged = $hasCustom && (
                $previousDirect !== $directRate
                || $previousOverride !== $overrideRate
            );
            $referralChanged = $hasReferral
                && ($previousReferral?->type !== $referralTerms?->type || $previousReferral?->value !== $referralTerms?->value);

            if ($customChanged || $referralChanged) {
                AgentCommissionRateAuditLog::create([
                    'company_id' => $agent->company_id,
                    'agent_id' => $agent->id,
                    'changed_by_user_id' => $userId,
                    'previous_direct_rate' => $customChanged ? $previousDirect : null,
                    'new_direct_rate' => $customChanged ? $directRate : null,
                    'previous_override_rate' => $customChanged ? $previousOverride : null,
                    'new_override_rate' => $customChanged ? $overrideRate : null,
                    'previous_referral_commission_type' => $referralChanged ? $previousReferral?->type->value : null,
                    'previous_referral_commission_value' => $referralChanged ? $previousReferral?->value : null,
                    'new_referral_commission_type' => $referralChanged ? $referralTerms?->type->value : null,
                    'new_referral_commission_value' => $referralChanged ? $referralTerms?->value : null,
                    'changed_at' => now(),
                    'reason' => $payload['reason'] ?? null,
                ]);

                if ($customChanged) {
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

    protected function getAuditLogs(int $agentId, int $companyId, int $perPage, bool $includeOverrideRates = true): LengthAwarePaginator
    {
        $logs = AgentCommissionRateAuditLog::where('company_id', $companyId)
            ->where('agent_id', $agentId)
            ->with([
                'changedByUser' => fn ($query) => $query
                    ->select('id', 'name')
                    ->without(['session', 'clientContact']),
            ])
            ->orderByDesc('changed_at')
            ->paginate($perPage);

        if (! $includeOverrideRates) {
            // In memory only, for this response: nothing is saved.
            $logs->getCollection()->each(fn (AgentCommissionRateAuditLog $row) => $row->forceFill([
                'previous_direct_rate' => null,
                'new_direct_rate' => null,
                'previous_override_rate' => null,
                'new_override_rate' => null,
            ]));
        }

        return $logs;
    }
}
