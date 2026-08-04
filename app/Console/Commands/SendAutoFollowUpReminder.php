<?php

namespace App\Console\Commands;

use App\Events\AutoFollowUpReminderEvent;
use App\Models\Company;
use App\Models\DealFollowUp;
use App\Support\ReminderFeature;
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
        if (ReminderFeature::enabledForCompany($company)) {
            return;
        }

        // Query using deal relationship (updated from lead to deal)
        $followups = DealFollowUp::with('deal', 'deal.leadAgent', 'deal.leadAgent.user')
            ->where('next_follow_up_date', '>=', now($company->timezone))
            ->whereHas('deal', function ($query) use ($company) {
                $query->where('company_id', $company->id);
            })
            ->where('send_reminder', 'yes')
            ->get();

        foreach ($followups as $followup) {
            // Collect all unique recipients: participants + deal agent
            $recipientIds = collect($followup->participants ?? []);
            
            // Add deal's lead agent if exists
            if ($followup->deal?->leadAgent?->user_id) {
                $recipientIds->push($followup->deal->leadAgent->user_id);
            }
            
            // Deduplicate recipients
            $uniqueRecipientIds = $recipientIds->unique()->filter()->values();
            
            // Track sent notifications to prevent duplicates within same run
            // Key format: {followupId}:{userId}:{reminderKey}
            $sentNotifications = [];
            
            foreach ($uniqueRecipientIds as $userId) {
                // Get effective reminders for this user (per-meeting override or user preference)
                $userReminders = $followup->getEffectiveReminders($userId);
                
                foreach ($userReminders as $reminder) {
                    $remindTime = $reminder['time'];
                    $remindType = $reminder['type'];
                    
                    // Create unique key for deduplication
                    $reminderKey = "{$followup->id}:{$userId}:{$remindTime}:{$remindType}";
                    
                    // Skip if already sent
                    if (in_array($reminderKey, $sentNotifications)) {
                        continue;
                    }

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
                        // Fire event with specific target user
                        event(new AutoFollowUpReminderEvent($followup, false, $reminder, $userId));
                        
                        // Mark as sent to prevent duplicates
                        $sentNotifications[] = $reminderKey;
                    }
                }
            }
            
            // If no participants/agents, fall back to original behavior (admins)
            if ($uniqueRecipientIds->isEmpty()) {
                $this->sendDefaultReminders($followup, $company, $sentNotifications);
            }
        }
    }
    
    /**
     * Send reminders using default behavior when no specific recipients
     * Uses system default reminders for legacy follow-ups without participants
     */
    private function sendDefaultReminders($followup, $company, array &$sentNotifications)
    {
        $allReminders = $followup->getAllReminders();
        
        foreach ($allReminders as $reminder) {
            $remindTime = $reminder['time'];
            $remindType = $reminder['type'];
            
            $reminderKey = "{$followup->id}:default:{$remindTime}:{$remindType}";
            
            if (in_array($reminderKey, $sentNotifications)) {
                continue;
            }

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

            if ($reminderDate->format('Y-m-d H:i') == now($company->timezone)->format('Y-m-d H:i')) {
                // No targetUserId - listener will fall back to deal agent or admins
                event(new AutoFollowUpReminderEvent($followup, false, $reminder, null));
                $sentNotifications[] = $reminderKey;
            }
        }
    }

}


