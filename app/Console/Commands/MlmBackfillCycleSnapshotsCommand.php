<?php

namespace App\Console\Commands;

use App\Models\MlmCycle;
use App\Services\CycleLevelSnapshotService;
use Illuminate\Console\Command;

class MlmBackfillCycleSnapshotsCommand extends Command
{
    protected $signature = 'mlm:backfill-cycle-snapshots
        {--company= : Company ID to process (all if omitted)}
        {--force : Re-snapshot even if snapshots already exist}';

    protected $description = 'Create level snapshots for any active cycles that are missing them';

    public function handle(CycleLevelSnapshotService $snapshotService): int
    {
        $query = MlmCycle::active();

        if ($companyId = $this->option('company')) {
            $query->where('company_id', $companyId);
        }

        $cycles = $query->get();

        if ($cycles->isEmpty()) {
            $this->info('No active cycles found.');
            return Command::SUCCESS;
        }

        $this->info("Found {$cycles->count()} active cycle(s).");

        foreach ($cycles as $cycle) {
            $label = "Cycle #{$cycle->cycle_number} (company {$cycle->company_id})";

            if ($cycle->hasSnapshots() && !$this->option('force')) {
                $this->line("  ⏭ {$label} — already has snapshots, skipping.");
                continue;
            }

            if ($this->option('force') && $cycle->hasSnapshots()) {
                $snapshotService->reSnapshot($cycle);
                $this->info("  ✔ {$label} — re-snapshotted (forced).");
            } else {
                $snapshotService->snapshotForCycle($cycle);
                $this->info("  ✔ {$label} — snapshot created.");
            }
        }

        $this->info('Done.');
        return Command::SUCCESS;
    }
}
