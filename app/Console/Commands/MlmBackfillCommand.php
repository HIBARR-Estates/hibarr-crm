<?php

namespace App\Console\Commands;

use App\Models\AgentMetric;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\PipelineStage;
use App\Services\MetricsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MlmBackfillCommand extends Command
{
    protected $signature = 'mlm:backfill {--company= : Company ID to backfill (all if omitted)} {--dry-run : Show what would be done without making changes}';
    protected $description = 'Backfill agent metrics and outcome_status from historical deal data';

    public function handle(MetricsService $metricsService): int
    {
        $companyId = $this->option('company');
        $dryRun = $this->option('dry-run');

        $this->info($dryRun ? '=== DRY RUN ===' : 'Starting MLM backfill...');

        // Step 1: Mark historical won deals
        $this->info('Step 1: Setting outcome_status on historical won deals...');
        $wonDealsUpdated = $this->backfillOutcomeStatus($companyId, $dryRun);
        $this->info("  → {$wonDealsUpdated} deals would be/were updated to outcome_status=won");

        // Step 2: Create/recalculate metrics for all agents
        $this->info('Step 2: Recalculating agent metrics...');
        $agentsProcessed = $this->recalculateAllMetrics($companyId, $metricsService, $dryRun);
        $this->info("  → {$agentsProcessed} agents processed");

        $this->info($dryRun ? '=== DRY RUN COMPLETE ===' : 'MLM backfill complete.');

        return Command::SUCCESS;
    }

    private function backfillOutcomeStatus(?string $companyId, bool $dryRun): int
    {
        // Find all deals at 'win' stage that don't have outcome_status set
        $query = Deal::query()
            ->whereNull('outcome_status')
            ->whereHas('leadStage', fn ($q) => $q->where('slug', 'win'));

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $count = $query->count();

        if (!$dryRun && $count > 0) {
            // Get win stage IDs per company
            $winStageIds = PipelineStage::where('slug', 'win')->pluck('id')->toArray();

            Deal::whereNull('outcome_status')
                ->whereIn('pipeline_stage_id', $winStageIds)
                ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
                ->update(['outcome_status' => 'won']);
        }

        // Also handle 'lost' stages
        $lostQuery = Deal::query()
            ->whereNull('outcome_status')
            ->whereHas('leadStage', fn ($q) => $q->where('slug', 'lost'));

        if ($companyId) {
            $lostQuery->where('company_id', $companyId);
        }

        $lostCount = $lostQuery->count();

        if (!$dryRun && $lostCount > 0) {
            $lostStageIds = PipelineStage::where('slug', 'lost')->pluck('id')->toArray();

            Deal::whereNull('outcome_status')
                ->whereIn('pipeline_stage_id', $lostStageIds)
                ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
                ->update(['outcome_status' => 'lost']);
        }

        return $count;
    }

    private function recalculateAllMetrics(?string $companyId, MetricsService $metricsService, bool $dryRun): int
    {
        $query = LeadAgent::query();

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $agents = $query->get();
        $count = 0;

        foreach ($agents as $agent) {
            if ($dryRun) {
                $count++;
                continue;
            }

            $metricsService->recalculateForAgent($agent);
            $count++;
        }

        return $count;
    }
}
