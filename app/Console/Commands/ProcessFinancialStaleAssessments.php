<?php

namespace App\Console\Commands;

use App\Services\FinancialAssessment\FinancialStaleScanner;
use Illuminate\Console\Command;

class ProcessFinancialStaleAssessments extends Command
{
    protected $signature = 'financial-assessments:process-stale';

    protected $description = 'Fire the "financial assessment stale" automation trigger for leads whose current assessment is past its refresh-due date';

    public function handle(FinancialStaleScanner $scanner): int
    {
        $fired = $scanner->scan();

        if ($fired > 0) {
            $this->info("Stale financial assessment automations ran for {$fired} lead(s).");
        }

        return Command::SUCCESS;
    }
}
