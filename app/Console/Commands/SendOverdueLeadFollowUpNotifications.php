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
                    try {
                        $leadNotificationService->notifyFollowUpOverdue($followUp);
                    } catch (\Throwable $e) {
                        \Log::error('Failed to send overdue follow-up notification', [
                            'follow_up_id' => $followUp->id,
                            'company_id' => $company->id,
                            'exception' => $e::class,
                        ]);
                    }
                }
            }
        });

        return Command::SUCCESS;
    }
}
