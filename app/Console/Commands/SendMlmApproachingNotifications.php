<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\MlmSetting;
use App\Services\MlmApproachingNotificationService;
use Illuminate\Console\Command;

class SendMlmApproachingNotifications extends Command
{
    protected $signature = 'send-mlm-approaching-notifications';

    protected $description = 'Notify agents when level criteria or cycle deadlines are approaching';

    public function handle(MlmApproachingNotificationService $service): int
    {
        $totals = ['level_approaching' => 0, 'cycle_deadline' => 0];

        Company::active()->chunk(50, function ($companies) use ($service, &$totals) {
            foreach ($companies as $company) {
                if (! MlmSetting::query()->where('company_id', $company->id)->exists()) {
                    continue;
                }

                $timezone = $company->timezone ?: 'UTC';
                $today = now($timezone)->toDateString();
                $stats = $service->processCompany((int) $company->id, $today);

                $totals['level_approaching'] += $stats['level_approaching'];
                $totals['cycle_deadline'] += $stats['cycle_deadline'];
            }
        });

        $this->info(sprintf(
            'MLM approaching notifications sent. level_approaching=%d, cycle_deadline=%d',
            $totals['level_approaching'],
            $totals['cycle_deadline'],
        ));

        return self::SUCCESS;
    }
}
