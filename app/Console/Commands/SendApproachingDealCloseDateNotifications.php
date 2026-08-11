<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\DealNotificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class SendApproachingDealCloseDateNotifications extends Command
{
    protected $signature = 'send-approaching-deal-close-date-notifications';

    protected $description = 'Notify deal agents and managers when a close date is approaching';

    public function handle(DealNotificationService $dealNotificationService): int
    {
        Company::active()->chunk(50, function ($companies) use ($dealNotificationService) {
            foreach ($companies as $company) {
                $timezone = $company->timezone ?: 'UTC';
                $today = now($timezone)->toDateString();
                $deals = $dealNotificationService->dealsWithApproachingCloseDateForCompany((int) $company->id);

                foreach ($deals as $deal) {
                    $cacheKey = "deal_close_date_reminder_sent:{$deal->id}:{$today}";

                    if (Cache::has($cacheKey)) {
                        continue;
                    }

                    $dealNotificationService->notifyCloseDateApproaching($deal);
                    Cache::put($cacheKey, true, now($timezone)->endOfDay());
                }
            }
        });

        return Command::SUCCESS;
    }
}
