<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\TimeRuntimeConformanceService;
use Illuminate\Console\Command;

class CheckTimeAlignmentCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'time:check-alignment
        {--json : Output report as JSON}
        {--no-publish : Do not publish PHP tzdata version to Redis}
        {--strict : Exit with non-zero code if unhealthy}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verify UTC runtime alignment (INV-11) and publish PHP tzdata version to shared Redis for cross-runtime drift monitoring';

    public function handle(TimeRuntimeConformanceService $service): int
    {
        $publishToRedis = ! (bool) $this->option('no-publish');
        $report = $service->checkAndPublish($publishToRedis);

        if ((bool) $this->option('json')) {
            $encoded = json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            $this->line($encoded !== false ? $encoded : '{}');
        } else {
            $utc = $report['utc'];
            $tzdata = $report['tzdata'];

            $this->line('Checked at: ' . $report['checkedAt']);
            $this->line('Healthy: ' . ($report['healthy'] ? 'yes' : 'no'));
            $this->line('UTC compliant: ' . ($utc['compliant'] ? 'yes' : 'no'));
            $this->line('PHP default timezone: ' . $utc['phpDefaultTimezone']);
            $this->line('App timezone: ' . $utc['appTimezone']);
            $this->line('Cron timezone: ' . $utc['cronTimezone']);
            $this->line('DB session timezone: ' . ($utc['dbSessionTimezone'] ?? 'unknown'));
            $this->line('PHP tzdata version: ' . ($tzdata['version'] ?? 'unavailable') . ' (source: ' . $tzdata['source'] . ')');
            $this->line('Published to Redis: ' . ($report['publishedToRedis'] ? 'yes' : 'no'));

            foreach ($utc['issues'] as $issue) {
                $this->warn(' - ' . $issue);
            }
        }

        if (! $report['healthy'] && (bool) $this->option('strict')) {
            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
