<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\LeadNotificationService;
use Illuminate\Console\Command;

class SendOverdueLeadFollowUpNotifications extends Command
{
    protected $signature = 'send-overdue-lead-followup-notifications';

    protected $description = 'Notify assigned agents and managers about overdue lead/deal follow-ups';

    public function handle(LeadNotificationService $leadNotificationService): int
    {
        Company::active()->chunk(50, function ($companies) use ($leadNotificationService) {
            foreach ($companies as $company) {
                $overdueFollowUps = $leadNotificationService->overdueFollowUpsForCompany((int) $company->id);

                foreach ($overdueFollowUps as $followUp) {
                    $leadNotificationService->notifyFollowUpOverdue($followUp);
                }
            }
        });

        return Command::SUCCESS;
    }
}
