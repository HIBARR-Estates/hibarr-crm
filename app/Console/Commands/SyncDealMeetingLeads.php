<?php

namespace App\Console\Commands;

use App\Services\DealMeetingLeadLinker;
use Illuminate\Console\Command;

class SyncDealMeetingLeads extends Command
{
    protected $signature = 'meetings:sync-deal-leads {--dry-run : Only report how many meetings are out of sync}';

    protected $description = "Link every deal meeting to its deal's lead (repairs meetings with a missing or stale lead_id)";

    public function handle(DealMeetingLeadLinker $linker): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $count = $linker->syncAll($dryRun);

        $this->info($dryRun
            ? "{$count} meeting(s) are not linked to their deal's lead."
            : "Linked {$count} meeting(s) to their deal's lead.");

        return self::SUCCESS;
    }
}
