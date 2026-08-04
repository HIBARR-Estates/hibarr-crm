<?php

namespace App\Jobs\Reminders;

use App\Models\Reminder;
use App\Support\ReminderFeature;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PrepareRemindersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct()
    {
        $this->onQueue('reminders-prepare');
    }

    public function handle(): void
    {
        if (!ReminderFeature::globallyEnabled()) {
            return;
        }

        $now = now();
        $until = $now->copy()->addMinutes(15);

        Reminder::query()
            ->where('status', Reminder::STATUS_PENDING)
            ->where('remind_at', '>', $now)
            ->where('remind_at', '<=', $until)
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $reminder) {
                    if (!ReminderFeature::companyInAllowlist((int) $reminder->company_id)) {
                        continue;
                    }

                    Reminder::query()
                        ->where('id', $reminder->id)
                        ->where('status', Reminder::STATUS_PENDING)
                        ->update([
                            'status' => Reminder::STATUS_SCHEDULED,
                            'updated_at' => now(),
                        ]);
                }
            });
    }
}
