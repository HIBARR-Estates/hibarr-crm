<?php

namespace App\Services\Deal;

use App\Enums\MlmCommissionStatus;
use App\Enums\OutcomeStatus;
use App\Models\Deal;
use App\Models\MlmCommission;
use App\Services\MetricsService;
use App\Services\MlmCommissionService;
use Illuminate\Support\Facades\DB;

/**
 * Applies a manual outcome change to a deal.
 *
 * This is not a plain field write. Marking a deal won fires DealWonEvent, which
 * queues ProcessDealWonJob to distribute MLM commissions and lock the deal — so
 * the reverse has to undo all of it, and nothing in the codebase did that before:
 * MlmCommissionService::revert() and MetricsService::decrementOnDealReverted()
 * both existed but only single-commission reversal from the MLM admin API ever
 * called them.
 *
 * Everything runs in one transaction so a deal can never end up un-won with its
 * commissions still standing.
 */
class DealOutcomeService
{
    public function __construct(
        private readonly MlmCommissionService $commissions,
        private readonly MetricsService $metrics,
    ) {
    }

    /**
     * @return array{
     *     changed: bool,
     *     from: string|null,
     *     to: string|null,
     *     reverted_commissions: int,
     *     paid_commissions_kept: int,
     *     commissions_queued: bool,
     * }
     */
    public function apply(Deal $deal, ?OutcomeStatus $outcome, string $reason): array
    {
        $current = $deal->outcome_status;

        if ($current === $outcome) {
            return [
                'changed' => false,
                'from' => $current?->value,
                'to' => $outcome?->value,
                'reverted_commissions' => 0,
                'paid_commissions_kept' => 0,
                'commissions_queued' => false,
            ];
        }

        return DB::transaction(function () use ($deal, $current, $outcome, $reason) {
            $reverted = 0;
            $paidKept = 0;

            // Leaving 'won' has to undo everything winning triggered.
            if ($current === OutcomeStatus::Won) {
                // Paid commissions are deliberately left alone by revert() — you
                // cannot un-pay money. Count them so the caller can say so.
                $paidKept = MlmCommission::where('deal_id', $deal->id)
                    ->where('status', MlmCommissionStatus::Paid->value)
                    ->count();

                $reverted = $this->commissions->revert($deal, $reason);
                $this->metrics->decrementOnDealReverted($deal);

                // Unlock, or every later edit stays blocked by the locked-deal guard.
                $deal->is_locked = false;
                $deal->locked_at = null;
            }

            $deal->outcome_status = $outcome;
            $deal->won_at = $outcome === OutcomeStatus::Won ? now() : null;

            // Fires DealWonEvent on the way in when $outcome is Won, which queues
            // commission distribution and re-locks the deal.
            $deal->save();

            return [
                'changed' => true,
                'from' => $current?->value,
                'to' => $outcome?->value,
                'reverted_commissions' => $reverted,
                'paid_commissions_kept' => $paidKept,
                // Queued, not done — ProcessDealWonJob is a ShouldQueue job, so
                // commissions do not exist yet when this returns.
                'commissions_queued' => $outcome === OutcomeStatus::Won
                    && $deal->agent_id !== null,
            ];
        });
    }
}
