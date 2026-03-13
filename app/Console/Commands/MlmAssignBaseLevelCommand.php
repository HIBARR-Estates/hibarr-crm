<?php

namespace App\Console\Commands;

use App\Models\LeadAgent;
use App\Services\LevelService;
use Illuminate\Console\Command;

class MlmAssignBaseLevelCommand extends Command
{
    protected $signature = 'mlm:assign-base-level
                            {--company= : Company ID to target (all companies if omitted)}
                            {--dry-run : Preview what would happen without making changes}';

    protected $description = 'Assign the lowest-rank MLM level to all agents that have no level assigned.';

    public function handle(LevelService $levelService): int
    {
        $companyId = $this->option('company') ? (int) $this->option('company') : null;
        $dryRun = (bool) $this->option('dry-run');

        if ($dryRun) {
            $this->warn('=== DRY RUN ===');
        }

        $baseLevel = $levelService->getBaseLevel($companyId);

        if (!$baseLevel) {
            $this->error('No MLM levels exist' . ($companyId ? " for company {$companyId}" : '') . '. Please create levels first.');
            return self::FAILURE;
        }

        $this->info("Base level: {$baseLevel->name} (Rank: {$baseLevel->rank}, Company: {$baseLevel->company_id})");

        $unassignedQuery = LeadAgent::whereDoesntHave('levelHistory');

        if ($companyId) {
            $unassignedQuery->where('company_id', $companyId);
        }

        $unassignedCount = $unassignedQuery->count();

        if ($unassignedCount === 0) {
            $this->info('All agents already have a level assigned. Nothing to do.');
            return self::SUCCESS;
        }

        $this->info("Agents without a level: {$unassignedCount}");

        if ($dryRun) {
            $this->warn("Would assign '{$baseLevel->name}' to {$unassignedCount} agent(s).");
            return self::SUCCESS;
        }

        if (!$this->confirm("Assign '{$baseLevel->name}' to {$unassignedCount} agent(s)?")) {
            $this->info('Aborted.');
            return self::SUCCESS;
        }

        $assigned = $levelService->backfillBaseLevelForAllAgents($companyId);

        $this->info("Successfully assigned base level to {$assigned} agent(s).");

        return self::SUCCESS;
    }
}
