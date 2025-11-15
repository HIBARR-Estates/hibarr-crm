<?php

namespace App\Console\Commands;

use App\Events\AutoFollowUpReminderEvent;
use App\Models\Company;
use App\Models\DealFollowUp;
use Illuminate\Console\Command;

class SendAutoFollowUpReminder extends Command
{

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'send-auto-followup-reminder';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send notification of followup to employee or added by user';


    /**
     * Execute the console command.
     *
     * @return mixed
     */

    public function handle()
    {
        Company::active()->chunk(50, function ($companies) {
            foreach ($companies as $company) {
                $this->sendFollowUpReminder($company);
            }
        });

        return Command::SUCCESS;
    }

    public function sendFollowUpReminder($company)
    {
        // Query using deal relationship (updated from lead to deal)
        $followups = DealFollowUp::with('deal', 'deal.leadAgent', 'deal.leadAgent.user')
            ->where('next_follow_up_date', '>=', now($company->timezone))
            ->whereHas('deal', function ($query) use ($company) {
                $query->where('company_id', $company->id);
            })
            ->where('send_reminder', 'yes')
            ->get();

        foreach ($followups as $followup) {
            // Get all reminders for this follow-up (defaults + custom)
            $allReminders = $followup->getAllReminders();
            
            foreach ($allReminders as $reminder) {
                $remindTime = $reminder['time'];
                $remindType = $reminder['type'];
                $reminderDate = null;

                $followupDate = clone $followup->next_follow_up_date;
                
                if ($remindType == 'day') {
                    $reminderDate = $followupDate->subDays($remindTime);
                }
                elseif ($remindType == 'hour') {
                    $reminderDate = $followupDate->subHours($remindTime);
                }
                else {
                    $reminderDate = $followupDate->subMinutes($remindTime);
                }

                // Check if it's time to send this specific reminder
                if ($reminderDate->format('Y-m-d H:i') == now($company->timezone)->format('Y-m-d H:i')) {
                    // Include reminder details in the event
                    event(new AutoFollowUpReminderEvent($followup, false, $reminder));
                }
            }
        }
    }

}


