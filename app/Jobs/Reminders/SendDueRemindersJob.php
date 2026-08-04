<?php

namespace App\Jobs\Reminders;

use App\Models\Reminder;
use App\Services\Reminders\ReminderSender;
use App\Support\ReminderFeature;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendDueRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct()
    {
        $this->onQueue('reminders-send');
    }

    public function handle(ReminderSender $sender): void
    {
        if (!ReminderFeature::globallyEnabled()) {
            return;
        }

        $now = now();

        Reminder::query()
            ->whereIn('status', [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED])
            ->where('remind_at', '<=', $now)
            ->orderBy('id')
            ->chunkById(100, function ($rows) use ($sender) {
                foreach ($rows as $reminder) {
                    if (!ReminderFeature::companyInAllowlist((int) $reminder->company_id)) {
                        continue;
                    }

                    $sender->send($reminder);
                }
            });
    }
}
