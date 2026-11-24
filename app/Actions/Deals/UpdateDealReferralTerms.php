<?php

namespace App\Actions\Deals;

use App\Models\Deal;
use App\Services\MlmCommissionService;
use App\Support\CommissionTerms;
use Illuminate\Support\Facades\DB;

/**
 * Writes a deal's own referral terms, or clears them, under the deal's row lock.
 *
 * Everything that decides whether the write is allowed is read from the locked
 * row, so a lock, a commission calculation or a change to the deal's value that
 * lands between the request's own checks and the write cannot be missed.
 * Permission and input validation stay with the caller.
 */
class UpdateDealReferralTerms
{
    public const UPDATED = 'updated';

    /** The deal as a whole is locked (is_locked). */
    public const DEAL_LOCKED = 'deal_locked';

    /** Commission has been calculated, so its inputs are frozen. */
    public const COMMISSION_LOCKED = 'commission_locked';

    /** The terms would pay more than the deal can carry. */
    public const EXCEEDS = 'exceeds';

    public function __construct(private MlmCommissionService $commissions) {}

    /**
     * @param  CommissionTerms|null  $terms  null clears the override
     * @return array{outcome: string, max: float|null} max is set when the outcome is EXCEEDS
     */
    public function handle(int $dealId, ?CommissionTerms $terms): array
    {
        return DB::transaction(function () use ($dealId, $terms) {
            $deal = Deal::query()->whereKey($dealId)->lockForUpdate()->firstOrFail();

            if ($deal->isLocked()) {
                return ['outcome' => self::DEAL_LOCKED, 'max' => null];
            }

            if ($deal->isCommissionLocked()) {
                return ['outcome' => self::COMMISSION_LOCKED, 'max' => null];
            }

            if ($terms !== null && ! $terms->isNone()) {
                $max = $this->commissions->maxReferralAmount($deal);

                if ($this->commissions->referralOverrideAmount($deal, $terms) > $max) {
                    return ['outcome' => self::EXCEEDS, 'max' => $max];
                }
            }

            $deal->referral_commission_type = $terms?->type->value;
            $deal->referral_commission_value = $terms?->value;
            $deal->save();

            return ['outcome' => self::UPDATED, 'max' => null];
        });
    }
}
