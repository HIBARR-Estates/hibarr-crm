<?php

namespace App\Console\Commands;

use App\Services\LeadContactSlaService;
use Illuminate\Console\Command;

/**
 * Flags first-contact clocks whose deadline has passed without contact, and logs it on the lead's
 * timeline. Runs every minute from the scheduler; each clock is flagged once.
 */
class FlagLeadContactSlaBreaches extends Command
{
    protected $signature = 'lead-contact-sla:flag-breaches';

    protected $description = 'Flag lead first-contact time limits that passed without contact';

    public function handle(LeadContactSlaService $sla): int
    {
        if (! LeadContactSlaService::enabled()) {
            return self::SUCCESS;
        }

        $flagged = $sla->flagBreaches();
        if ($flagged > 0) {
            $this->info("Flagged {$flagged} lead contact time limit(s).");
        }

        return self::SUCCESS;
    }
}
