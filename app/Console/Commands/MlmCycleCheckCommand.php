<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\MlmSetting;
use App\Services\CycleService;
use Illuminate\Console\Command;

class MlmCycleCheckCommand extends Command
{
    protected $signature = 'mlm:cycle-check
        {--company= : Process only a specific company}
        {--dry-run : Show what would happen without making changes}';

    protected $description = 'Check and transition MLM cycle statuses, handle overflow expirations, and auto-generate new cycles';

    public function handle(CycleService $cycleService): int
    {
        $this->info('MLM Cycle Check starting...');

        $query = MlmSetting::query();

        if ($companyId = $this->option('company')) {
            $query->where('company_id', $companyId);
        }

        $settings = $query->get();

        if ($settings->isEmpty()) {
            $this->warn('No MLM settings found.');
            return 0;
        }

        $isDryRun = $this->option('dry-run');
        $totalStats = [
            'companies_processed' => 0,
            'cycles_activated' => 0,
            'cycles_completed' => 0,
            'enrollments_extended' => 0,
            'enrollments_force_completed' => 0,
            'enrollments_auto_enrolled' => 0,
        ];

        foreach ($settings as $setting) {
            $this->line("Processing company #{$setting->company_id}...");

            if ($isDryRun) {
                $this->info("  [DRY RUN] Would transition cycle statuses for company #{$setting->company_id}");
                $totalStats['companies_processed']++;
                continue;
            }

            $stats = $cycleService->transitionCycleStatuses($setting->company_id);

            $totalStats['companies_processed']++;
            $totalStats['cycles_activated'] += $stats['cycles_activated'];
            $totalStats['cycles_completed'] += $stats['cycles_completed'];
            $totalStats['enrollments_extended'] += $stats['enrollments_extended'];
            $totalStats['enrollments_force_completed'] += $stats['enrollments_force_completed'];
            $totalStats['enrollments_auto_enrolled'] += $stats['enrollments_auto_enrolled'];

            $this->line("  Cycles activated: {$stats['cycles_activated']}");
            $this->line("  Cycles completed: {$stats['cycles_completed']}");
            $this->line("  Enrollments extended: {$stats['enrollments_extended']}");
            $this->line("  Enrollments force-completed: {$stats['enrollments_force_completed']}");
            $this->line("  Enrollments auto-enrolled: {$stats['enrollments_auto_enrolled']}");
        }

        $this->newLine();
        $this->info('Summary:');
        $this->table(
            ['Metric', 'Count'],
            collect($totalStats)->map(fn ($v, $k) => [str_replace('_', ' ', ucfirst($k)), $v])->values()->toArray()
        );

        $this->info('MLM Cycle Check complete.');

        return 0;
    }
}
