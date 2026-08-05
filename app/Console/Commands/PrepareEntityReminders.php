<?php

namespace App\Console\Commands;

use App\Jobs\Reminders\PrepareRemindersJob;
use Illuminate\Console\Command;

class PrepareEntityReminders extends Command
{
    protected $signature = 'reminders:prepare';

    protected $description = 'Mark pending entity reminders due in the next 15 minutes as scheduled';

    public function handle(): int
    {
        PrepareRemindersJob::dispatchSync();

        return self::SUCCESS;
    }
}
