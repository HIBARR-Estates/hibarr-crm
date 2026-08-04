<?php

namespace App\Console\Commands;

use App\Jobs\Reminders\SendDueRemindersJob;
use Illuminate\Console\Command;

class SendDueEntityReminders extends Command
{
    protected $signature = 'reminders:send-due';

    protected $description = 'Send due entity reminders (pending/scheduled with remind_at <= now)';

    public function handle(): int
    {
        SendDueRemindersJob::dispatchSync();

        return self::SUCCESS;
    }
}
