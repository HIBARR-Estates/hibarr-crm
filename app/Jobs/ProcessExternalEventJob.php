<?php

namespace App\Jobs;

use App\Models\ExternalEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessExternalEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $externalEvent;

    /**
     * Create a new job instance.
     */
    public function __construct(ExternalEvent $externalEvent)
    {
        $this->externalEvent = $externalEvent;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->externalEvent->update(['status' => 'processing']);

            // Logic to process the event based on event_type
            // For now, we just log it.
            Log::info('Processing External Event: ' . $this->externalEvent->event_type, [
                'payload' => $this->externalEvent->payload,
                'metadata' => $this->externalEvent->metadata,
            ]);

            // TODO: Implement specific event handlers here
            // e.g. if ($this->externalEvent->event_type === 'lead.created') { ... }

            $this->externalEvent->update([
                'status' => 'processed',
                'processed_at' => now(),
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to process External Event: ' . $e->getMessage());
            $this->externalEvent->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
            
            // Optionally release the job back to the queue if it's a transient error
            // $this->release(10);
        }
    }
}
