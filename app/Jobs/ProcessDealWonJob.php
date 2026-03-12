<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\LeadAgent;
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
     * 1. Idempotency guard (skip if already locked)
     * 2. Set outcome_status = 'won'
     * 3. Update agent metrics (NSA/VSA + ancestor NSD/VSD)
     * 4. Evaluate level qualifications (agent + all ancestors)
     * 5. Distribute commissions (differential model)
     * 6. Lock the deal
     */
    public function handle(
        MetricsService $metricsService,
        LevelService $levelService,
        MlmCommissionService $commissionService
    ): void {
        $deal = $this->deal->fresh();

        if (!$deal) {
            Log::warning("ProcessDealWonJob: Deal not found, skipping");
            return;
        }

        // Idempotency guard: skip if already processed
        if ($deal->is_locked) {
            Log::info("ProcessDealWonJob: Deal {$deal->id} already locked, skipping");
            return;
        }

        $agent = LeadAgent::find($deal->agent_id);

        if (!$agent) {
            Log::warning("ProcessDealWonJob: No agent found for deal {$deal->id}, skipping");
            return;
        }

        DB::transaction(function () use ($deal, $agent, $metricsService, $levelService, $commissionService) {
            Log::info("ProcessDealWonJob: Starting MLM pipeline for deal {$deal->id}, agent {$agent->id}");

            // Step 1: Set outcome status
            $deal->outcome_status = 'won';

            // Step 2: Update agent metrics
            $metricsService->incrementOnDealWon($deal);

            // Step 3: Evaluate level qualifications (agent + ancestors)
            $levelService->evaluateWithAncestors($agent, $deal);

            // Step 4: Distribute commissions
            $commissionService->distribute($deal);

            // Step 5: Lock the deal
            $deal->is_locked = true;
            $deal->locked_at = now();
            $deal->saveQuietly(); // Bypass observer to prevent re-triggering

            Log::info("ProcessDealWonJob: Completed MLM pipeline for deal {$deal->id}");
        });
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
