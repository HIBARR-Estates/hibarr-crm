<?php

namespace App\Console\Commands;

use App\Services\HierarchyService;
use Illuminate\Console\Command;

class MlmRebuildHierarchyCommand extends Command
{
    protected $signature = 'mlm:rebuild-hierarchy {--company= : Company ID to rebuild (all if omitted)}';
    protected $description = 'Rebuild the agent_hierarchy closure table from parent_agent_id fields';

    public function handle(HierarchyService $hierarchyService): int
    {
        $companyId = $this->option('company');

        $this->info('Rebuilding agent hierarchy closure table...');

        $count = $hierarchyService->rebuildAll($companyId ? (int) $companyId : null);

        $this->info("Rebuild complete. Processed {$count} agents.");

        return Command::SUCCESS;
    }
}
