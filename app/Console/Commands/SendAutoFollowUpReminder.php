<?php

namespace App\Console\Commands;

use App\Events\AutoFollowUpReminderEvent;
use App\Models\Company;
use App\Models\DealFollowUp;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

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
     * Match window in minutes — catches reminders even if the cron slips by a few minutes.
     */
    private const MATCH_WINDOW_MINUTES = 5;

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
        $now = now($company->timezone);

        // Include both deal-linked and lead-only meetings that still need reminders.
        $followups = DealFollowUp::with([
            'deal',
            'deal.leadAgent',
            'deal.leadAgent.user',
            'deal.contact',
            'lead',
            'lead.leadOwner',
        ])
            ->where('next_follow_up_date', '>=', $now->copy()->subDay())
            ->where(function ($query) use ($company) {
                $query->whereHas('deal', function ($q) use ($company) {
                    $q->where('company_id', $company->id);
                })->orWhere(function ($q) use ($company) {
                    $q->whereNull('deal_id')
                        ->whereNotNull('lead_id')
                        ->whereHas('lead', function ($leadQuery) use ($company) {
                            $leadQuery->where('company_id', $company->id);
                        });
                });
            })
            ->where(function ($query) {
                $query->where('send_reminder', 'yes')
                    ->orWhereNull('send_reminder')
                    ->orWhere('send_reminder', '');
            })
            ->get();

        foreach ($followups as $followup) {
            $recipientIds = collect($followup->participants ?? []);

            if ($followup->deal?->leadAgent?->user_id) {
                $recipientIds->push($followup->deal->leadAgent->user_id);
            }

            if ($followup->lead?->lead_owner) {
                $recipientIds->push($followup->lead->lead_owner);
            }

            if ($followup->added_by) {
                $recipientIds->push($followup->added_by);
            }

            $uniqueRecipientIds = $recipientIds->unique()->filter()->values();

            $sentNotifications = [];

            foreach ($uniqueRecipientIds as $userId) {
                $userReminders = $followup->getEffectiveReminders((int) $userId);

                foreach ($userReminders as $reminder) {
                    $this->maybeFireReminder(
                        $followup,
                        $reminder,
                        $company,
                        $now,
                        (int) $userId,
                        $sentNotifications
                    );
                }
            }

            if ($uniqueRecipientIds->isEmpty()) {
                $this->sendDefaultReminders($followup, $company, $now, $sentNotifications);
            }
        }
    }

    /**
     * @param  array<int, string>  $sentNotifications
     */
    private function sendDefaultReminders($followup, $company, $now, array &$sentNotifications): void
    {
        foreach ($followup->getAllReminders() as $reminder) {
            $this->maybeFireReminder(
                $followup,
                $reminder,
                $company,
                $now,
                null,
                $sentNotifications
            );
        }
    }

    /**
     * @param  array<string, mixed>  $reminder
     * @param  array<int, string>  $sentNotifications
     */
    private function maybeFireReminder(
        $followup,
        array $reminder,
        $company,
        $now,
        ?int $userId,
        array &$sentNotifications
    ): void {
        $remindTime = (int) ($reminder['time'] ?? 0);
        $remindType = $reminder['type'] ?? 'minute';
        $userKey = $userId ?? 'default';
        $reminderKey = "{$followup->id}:{$userKey}:{$remindTime}:{$remindType}";

        if (in_array($reminderKey, $sentNotifications, true)) {
            return;
        }

        // Cross-run de-dupe for the widened match window.
        $cacheKey = "followup_reminder_sent:{$reminderKey}";
        if (Cache::has($cacheKey)) {
            return;
        }

        $followupDate = clone $followup->next_follow_up_date;

        if ($remindType === 'day') {
            $reminderDate = $followupDate->subDays($remindTime);
        } elseif ($remindType === 'hour') {
            $reminderDate = $followupDate->subHours($remindTime);
        } else {
            $reminderDate = $followupDate->subMinutes($remindTime);
        }

        $windowStart = $now->copy()->subMinutes(self::MATCH_WINDOW_MINUTES);
        $windowEnd = $now->copy()->addMinute();

        if ($reminderDate->lt($windowStart) || $reminderDate->gt($windowEnd)) {
            return;
        }

        event(new AutoFollowUpReminderEvent($followup, false, $reminder, $userId));
        $sentNotifications[] = $reminderKey;
        // Keep longer than the match window so a late cron can't re-fire.
        Cache::put($cacheKey, true, now()->addHours(12));
    }
}
