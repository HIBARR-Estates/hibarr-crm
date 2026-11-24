<?php

namespace App\Actions\Packages;

use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;
use App\Models\Package;
use App\Support\CommissionTerms;

/**
 * Saves what one agent earns on one package.
 *
 * The agent has a single row per package that holds both roles: what they earn as
 * the closer of a deal on the package, and what they earn as the referrer. A role
 * the caller does not set is left exactly as it was, so changing one never
 * disturbs the other. A row left with neither role is removed.
 */
class SaveAgentPackageTerms
{
    public const SAVED = 'saved';

    public const REMOVED = 'removed';

    /** Nothing to store and no row to remove: the request stated no terms at all. */
    public const EMPTY = 'empty';

    /**
     * @param  CommissionTerms|null  $closer  null with $setCloser: no closer override, the package default applies
     * @param  CommissionTerms|null  $referral  null with $setReferral: no referral terms
     * @return self::SAVED|self::REMOVED|self::EMPTY
     */
    public function handle(
        Package $package,
        LeadAgent $agent,
        int $companyId,
        bool $setCloser,
        ?CommissionTerms $closer,
        bool $setReferral,
        ?CommissionTerms $referral,
    ): string {
        $row = AgentPackageCommissionRate::firstOrNew([
            'agent_id' => $agent->id,
            'package_id' => $package->id,
        ]);
        // CompanyScope only filters reads; it never fills this in.
        $row->company_id = $companyId;

        if ($setCloser) {
            // None has nothing to store.
            $row->commission_type = $closer?->type->value;
            $row->commission_value = $closer?->value;
        }

        if ($setReferral) {
            // "None" and no terms pay a referrer the same, so both are no terms.
            $referral = $referral?->isNone() ? null : $referral;
            $row->referral_commission_type = $referral?->type->value;
            $row->referral_commission_value = $referral?->value;
        }

        if ($row->commission_type === null && $row->referral_commission_type === null) {
            if (! $row->exists) {
                return self::EMPTY;
            }

            $row->delete();

            return self::REMOVED;
        }

        $row->save();

        return self::SAVED;
    }
}
