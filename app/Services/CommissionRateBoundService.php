<?php

namespace App\Services;

use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Models\MlmSetting;

class CommissionRateBoundService
{
    public function __construct(
        protected LevelService $levelService
    ) {}

    /**
     * @return array{directCeiling: float, overrideCeiling: float, isHighestVisibleLevel: bool}
     */
    public function resolveBounds(LeadAgent $agent): array
    {
        $level = $this->levelService->getCurrentLevel($agent);

        if (!$level) {
            return [
                'directCeiling' => 0.0,
                'overrideCeiling' => 0.0,
                'isHighestVisibleLevel' => false,
            ];
        }

        $visibleLevels = MlmLevel::where('company_id', $agent->company_id)
            ->visible()
            ->ordered()
            ->get();

        if ($visibleLevels->isEmpty()) {
            return [
                'directCeiling' => 0.0,
                'overrideCeiling' => 0.0,
                'isHighestVisibleLevel' => false,
            ];
        }

        $highestVisible = $visibleLevels->last();
        $isHighestVisibleLevel = $highestVisible && (int) $highestVisible->id === (int) $level->id;

        if ($isHighestVisibleLevel) {
            $max = (float) MlmSetting::forCompany($agent->company_id)->max_commission_percentage;

            return [
                'directCeiling' => $max,
                'overrideCeiling' => $max,
                'isHighestVisibleLevel' => true,
            ];
        }

        $nextVisibleLevel = $visibleLevels->first(fn (MlmLevel $visibleLevel) => $visibleLevel->rank > $level->rank);

        if (!$nextVisibleLevel) {
            $max = (float) MlmSetting::forCompany($agent->company_id)->max_commission_percentage;

            return [
                'directCeiling' => $max,
                'overrideCeiling' => $max,
                'isHighestVisibleLevel' => false,
            ];
        }

        return [
            'directCeiling' => (float) $nextVisibleLevel->direct_rate,
            'overrideCeiling' => (float) $nextVisibleLevel->override_rate,
            'isHighestVisibleLevel' => false,
        ];
    }

    /**
     * @return array<string, list<string>>
     */
    public function validateRates(LeadAgent $agent, ?float $directRate, ?float $overrideRate): array
    {
        $bounds = $this->resolveBounds($agent);
        $errors = [];

        if ($directRate !== null) {
            if ($directRate < 0 || $directRate > $bounds['directCeiling']) {
                $errors['custom_direct_rate'] = [
                    sprintf(
                        'Direct rate must be between 0 and %.2f (inclusive).',
                        $bounds['directCeiling']
                    ),
                ];
            }
        }

        if ($overrideRate !== null) {
            if ($overrideRate < 0 || $overrideRate > $bounds['overrideCeiling']) {
                $errors['custom_override_rate'] = [
                    sprintf(
                        'Override rate must be between 0 and %.2f (inclusive).',
                        $bounds['overrideCeiling']
                    ),
                ];
            }
        }

        return $errors;
    }

    public function getEffectiveCeiling(LeadAgent $agent): float
    {
        $bounds = $this->resolveBounds($agent);

        return min($bounds['directCeiling'], $bounds['overrideCeiling']);
    }

    /**
     * @return array<string, list<string>>
     */
    public function validateUnifiedRate(LeadAgent $agent, ?float $rate): array
    {
        if ($rate === null) {
            return [];
        }

        $errors = $this->validateRates($agent, $rate, $rate);

        if ($errors === []) {
            return [];
        }

        $ceiling = $this->getEffectiveCeiling($agent);

        return [
            'custom_commission_rate' => [
                sprintf(
                    'Commission rate must be between 0 and %.2f (inclusive).',
                    $ceiling
                ),
            ],
        ];
    }
}
