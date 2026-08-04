<?php

namespace App\Jobs\Reminders;

use App\Models\Reminder;
use App\Services\Reminders\ReminderSender;
use App\Support\FeatureFlags;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $reminderId
    ) {
        $this->onQueue('reminders-send');
    }

    public function handle(ReminderSender $sender): void
    {
        if (!FeatureFlags::enabled('crm.entity-reminders')) {
            return;
        }

        $reminder = Reminder::query()->find($this->reminderId);
        if (!$reminder) {
            return;
        }

        $sender->send($reminder);
    }
}
