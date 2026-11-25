<?php

namespace App\Actions\Packages;

use App\Enums\PackageCommissionType;
use App\Models\AgentPackageCommissionRate;
use App\Models\LeadAgent;
use App\Models\Package;
use App\Support\CommissionTerms;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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
     * Validation for a request that sets an agent's terms on a package. Used by
     * every screen that edits them, so the rules are stated once.
     *
     * With the referral feature on, a row can state its referral terms alone, so
     * the closer rule is optional there.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function rules(Request $request, bool $referralEnabled): array
    {
        $rules = [
            'commission_type' => [$referralEnabled ? 'nullable' : 'required', Rule::enum(PackageCommissionType::class)],
            'commission_value' => self::valueRules($request, 'commission_type'),
        ];

        if ($referralEnabled) {
            $rules['referral_commission_type'] = ['nullable', Rule::enum(PackageCommissionType::class)];
            $rules['referral_commission_value'] = self::valueRules($request, 'referral_commission_type');
        }

        return $rules;
    }

    /**
     * A value is required for percentage and fixed only; "none" has nothing to
     * enter, and no type at all is not a value-less type. `required_if` (not
     * `required_with`) makes that distinction.
     *
     * $typeField names the type the value belongs to: the closer's commission or
     * the referral commission, which share these rules.
     *
     * @return array<int, string>
     */
    public static function valueRules(Request $request, string $typeField = 'commission_type'): array
    {
        return array_merge(
            [
                'nullable',
                'required_if:'.$typeField.','.PackageCommissionType::Percentage->value.','.PackageCommissionType::Fixed->value,
                'numeric',
                'min:0',
            ],
            // Only a percentage is bounded at 100: a flat fee is money, and capping
            // it at 100 would quietly reject a 250 package fee.
            $request->input($typeField) === PackageCommissionType::Percentage->value
                ? ['max:100']
                : []
        );
    }

    /**
     * Saves the terms a validated request states. A role the request does not
     * mention is left as it was.
     *
     * @param  array<string, mixed>  $validated  the request's validated input, from self::rules()
     * @return self::SAVED|self::REMOVED|self::EMPTY
     */
    public function handleRequest(
        Package $package,
        LeadAgent $agent,
        Request $request,
        array $validated,
        int $companyId,
        bool $referralEnabled,
    ): string {
        return $this->handle(
            $package,
            $agent,
            $companyId,
            setCloser: $request->exists('commission_type'),
            closer: CommissionTerms::make($validated['commission_type'] ?? null, $validated['commission_value'] ?? null),
            setReferral: $referralEnabled && $request->exists('referral_commission_type'),
            referral: $referralEnabled
                ? CommissionTerms::make($validated['referral_commission_type'] ?? null, $validated['referral_commission_value'] ?? null)
                : null,
        );
    }

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
