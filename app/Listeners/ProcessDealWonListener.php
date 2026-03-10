<?php

namespace App\Listeners;

use App\Events\DealWonEvent;
use App\Jobs\ProcessDealWonJob;
use Illuminate\Support\Facades\Log;

class ProcessDealWonListener
{
    /**
     * Handle the DealWonEvent by dispatching the MLM processing job.
     *
     * This listener acts as a bridge between the event system and the
     * queue, ensuring the full MLM pipeline runs transactionally in a job.
     */
    public function handle(DealWonEvent $event): void
    {
        Log::info("ProcessDealWonListener: Dispatching MLM job for deal {$event->deal->id}");

        ProcessDealWonJob::dispatch($event->deal);
    }
}
