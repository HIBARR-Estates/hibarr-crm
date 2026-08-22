<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\DealAutomationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ProcessAutomationPendingRuns extends Command
{
    /**
     * Drains deal_automation_pending_runs rows whose run_at has passed —
     * the execution half of the automation "wait" option. Runs every minute
     * so waits configured in minutes stay reasonably accurate; each run
     * re-checks conditions (DealAutomationService::runPending) since the
     * subject may have changed during the wait.
     */
    protected $signature = 'deal-automations:process-pending-runs';

    protected $description = 'Execute waited deal/lead automations whose wait period has elapsed';

    public function handle(DealAutomationService $automationService): int
    {
        Company::active()->chunk(50, function ($companies) use ($automationService) {
            foreach ($companies as $company) {
                // Actions read date formats and ids through the company()
                // helper — bind it for this company's pass, same as the
                // date-trigger command.
                session(['company' => $company]);

                $due = \App\Models\DealAutomationPendingRun::query()
                    ->where('company_id', (int) $company->id)
                    ->where('run_at', '<=', now())
                    ->with('automation')
                    ->orderBy('run_at')
                    ->get();

                foreach ($due as $pendingRun) {
                    // Delete first: the unique index frees up immediately, so a
                    // trigger firing mid-execution can queue a fresh run rather
                    // than colliding with this one; a crash mid-action loses one
                    // pass instead of re-firing actions forever.
                    $pendingRun->delete();

                    try {
                        $automationService->runPending($pendingRun);
                    } catch (\Throwable $e) {
                        Log::error("Waited automation run #{$pendingRun->id} failed", [
                            'automation_id' => $pendingRun->deal_automation_id,
                            'subject_type' => $pendingRun->subject_type,
                            'subject_id' => $pendingRun->subject_id,
                            'exception' => $e->getMessage(),
                        ]);
                    }
                }
            }
        });

        return Command::SUCCESS;
    }
}
