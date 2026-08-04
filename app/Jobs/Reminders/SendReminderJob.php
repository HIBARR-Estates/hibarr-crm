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
        if (!ReminderFeature::globallyEnabled()) {
            return;
        }

        $reminder = Reminder::query()->find($this->reminderId);
        if (!$reminder) {
            return;
        }

        $sender->send($reminder);
    }
}
