<?php

namespace App\Jobs;

use App\Enums\EnrollmentStatus;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Services\CycleService;
use App\Services\LevelService;
use App\Services\MetricsService;
use App\Services\MlmCommissionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ProcessDealWonJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 60;

    protected Deal $deal;

    public function __construct(Deal $deal)
    {
        $this->deal = $deal;
        $this->onQueue(config('mlm.queue_connection', 'default'));
    }

    /**
     * Execute the full MLM pipeline within a single database transaction.
     *
     * Steps:
     * 1. Idempotency guard (skip if commission was already distributed)
     * 2. Validate deal is won and has an agent
     * 3. Update agent metrics (all-time + cycle: NSA/VSA + ancestor NSD/VSD)
     * 4. Evaluate level qualifications (agent + all ancestors, using cycle metrics)
     * 5. Check for enrollment completions (criteria met while in overflow → complete → re-enroll)
     * 6. Distribute commissions (differential model)
     * 7. Mark the deal commission-locked (value can no longer change)
     */
    public function handle(
        MetricsService $metricsService,
        LevelService $levelService,
        MlmCommissionService $commissionService,
        CycleService $cycleService
    ): void {
        $deal = $this->deal->fresh(['packages']);

        if (! $deal) {
            Log::warning('ProcessDealWonJob: Deal not found, skipping');

            return;
        }

        // Idempotency guard: skip only if commission was already distributed
        // for this deal. is_locked is NOT a safe proxy for that — winning a
        // deal does not lock it (see Deal::isLocked()'s doc comment); a
        // separate lock_deal automation action, or a manual lock, can set
        // is_locked=true for reasons that have nothing to do with whether
        // commission has run. commission_locked is the one field this job
        // owns, set only here and cleared only by DealOutcomeService::apply()
        // on a genuine revert — safe to trust as the single source of truth.
        if ($deal->commission_locked) {
            Log::info("ProcessDealWonJob: Deal {$deal->id} already commission-locked, skipping");

            return;
        }

        $agent = LeadAgent::find($deal->agent_id);

        if (! $agent) {
            Log::warning("ProcessDealWonJob: No agent found for deal {$deal->id}, skipping");

            return;
        }
        if ($deal->outcome_status !== \App\Enums\OutcomeStatus::Won) {
            Log::warning("ProcessDealWonJob: Deal {$deal->id} is not marked as won, skipping. Only won deals should trigger this job.");

            return;
        }

        DB::transaction(function () use ($deal, $agent, $metricsService, $levelService, $commissionService, $cycleService) {
            Log::info("ProcessDealWonJob: Starting MLM pipeline for deal {$deal->id}, agent {$agent->id}");

            // Step 1: Update agent metrics (all-time + cycle)
            $metricsService->incrementOnDealWon($deal);

            // Step 2: Evaluate level qualifications (agent + ancestors, using cycle metrics)
            $levelService->evaluateWithAncestors($agent, $deal);

            // Step 3: Check for enrollment completions
            // If the agent's enrollment is extended (overflow) and they now qualify for a level,
            // complete the enrollment and re-enroll them in the current cycle.
            $this->checkEnrollmentCompletions($agent, $levelService, $cycleService);

            // Also check ancestors
            $ancestors = app(\App\Services\HierarchyService::class)->getAncestors($agent);
            foreach ($ancestors as $ancestor) {
                $this->checkEnrollmentCompletions($ancestor, $levelService, $cycleService);
            }

            // Step 4: Distribute commissions
            $commissionService->distribute($deal);

            // Step 5: Commission-lock the deal — its value can no longer
            // change, but everything else (stage, agent, notes) stays
            // editable. Deliberately NOT is_locked: that's a separate,
            // broader freeze this job does not own (see Deal::isLocked()).
            $deal->commission_locked = true;
            $deal->commission_locked_at = now();
            $deal->saveQuietly(); // Bypass observer to prevent re-triggering

            Log::info("ProcessDealWonJob: Completed MLM pipeline for deal {$deal->id}");
        });
    }

    /**
     * Check if an agent's enrollment should be completed.
     *
     * An enrollment is completed when:
     * - The enrollment is in 'extended' (overflow) status
     * - The agent now meets the level criteria for at least their current level
     *
     * On completion, the agent is auto-enrolled in the current company cycle.
     */
    protected function checkEnrollmentCompletions(
        LeadAgent $agent,
        LevelService $levelService,
        CycleService $cycleService
    ): void {
        $enrollment = $cycleService->getActiveEnrollment($agent);

        if (! $enrollment || $enrollment->status !== EnrollmentStatus::Extended) {
            return; // Only check enrollments in overflow
        }

        // Check if the agent now meets criteria for any level above base
        $currentLevel = $levelService->getCurrentLevel($agent);

        if ($currentLevel) {
            // Agent has a level — enrollment criteria considered met
            $cycleService->completeEnrollment($enrollment, $currentLevel);
            Log::info("ProcessDealWonJob: Agent {$agent->id} enrollment completed during overflow (level: {$currentLevel->name})");
        }
    }

    /**
     * Handle job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("ProcessDealWonJob: Failed for deal {$this->deal->id}", [
            'exception' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString(),
        ]);
    }
}
