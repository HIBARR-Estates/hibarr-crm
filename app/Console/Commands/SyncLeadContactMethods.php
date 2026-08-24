<?php

namespace App\Console\Commands;

use App\Models\Lead;
use App\Services\LeadContactMethodService;
use Illuminate\Console\Command;

class SyncLeadContactMethods extends Command
{
    protected $signature = 'leads:sync-contact-methods';

    protected $description = 'Backfill lead_contact_methods from existing leads.client_email/mobile/cell/office (safe to re-run)';

    public function handle(LeadContactMethodService $contactMethodService): int
    {
        $count = 0;

        Lead::query()->chunkById(200, function ($leads) use ($contactMethodService, &$count) {
            foreach ($leads as $lead) {
                $contactMethodService->syncFromLeadColumns($lead);
                $count++;
            }
        });

        $this->info("Synced contact methods for {$count} leads.");

        return Command::SUCCESS;
    }
}
