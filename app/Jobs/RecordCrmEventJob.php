<?php

namespace App\Jobs;

use App\Services\CrmEventService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Queue job for asynchronous CRM event recording.
 *
 * Dispatched by CrmEventService when an event type has sync_processing = false.
 * Receives the validated event payload and persists it via CrmEventService::record()
 * with forceSync = true to prevent infinite dispatch loops.
 */
class RecordCrmEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 30;

    /**
     * Create a new job instance.
     *
     * @param array $eventData The validated event payload array.
     */
    public function __construct(
        protected array $eventData
    ) {}

    /**
     * Execute the job.
     */
    public function handle(CrmEventService $service): void
    {
        try {
            // Re-compose the params with the event_type_slug for resolution.
            // Since we already resolved the event_type_id in CrmEventService::record(),
            // we pass the data directly to create.
            \App\Models\CrmEvent::withoutGlobalScopes()->create($this->eventData);

            Log::debug('RecordCrmEventJob — Event recorded successfully.', [
                'uuid' => $this->eventData['uuid'] ?? 'unknown',
            ]);
        } catch (\Throwable $e) {
            Log::error('RecordCrmEventJob — Failed to record event.', [
                'uuid' => $this->eventData['uuid'] ?? 'unknown',
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('RecordCrmEventJob — Job permanently failed.', [
            'uuid' => $this->eventData['uuid'] ?? 'unknown',
            'error' => $exception->getMessage(),
        ]);
    }
}
