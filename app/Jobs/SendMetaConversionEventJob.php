<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Services\MetaConversionsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Job to send Meta Conversion API events in the background
 * 
 * This job is queued when a deal moves to a stage that has
 * a Meta conversion trigger configured.
 */
class SendMetaConversionEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     *
     * @var int
     */
    public $backoff = 10;

    /**
     * The deal instance
     *
     * @var \App\Models\Deal
     */
    protected Deal $deal;

    /**
     * The event name to send to Meta
     *
     * @var string
     */
    protected string $eventName;

    /**
     * The conversion value to send to Meta
     *
     * @var float
     */
    protected float $value;

    /**
     * Create a new job instance.
     *
     * @param Deal $deal
     * @param string $eventName
     * @param float $value
     */
    public function __construct(Deal $deal, string $eventName, float $value = 0)
    {
        $this->deal = $deal;
        $this->eventName = $eventName;
        $this->value = $value;
    }

    /**
     * Execute the job.
     *
     * @param MetaConversionsService $metaService
     * @return void
     */
    public function handle(MetaConversionsService $metaService): void
    {
        try {
            Log::info('Processing Meta Conversion Event Job', [
                'deal_id' => $this->deal->id,
                'event_name' => $this->eventName,
                'value' => $this->value,
                'attempt' => $this->attempts(),
            ]);

            // Send the event to Meta Conversions API
            $success = $metaService->sendEvent($this->eventName, $this->value, $this->deal);

            if ($success) {
                Log::info('Meta Conversion Event Job completed successfully', [
                    'deal_id' => $this->deal->id,
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                ]);
            } else {
                Log::warning('Meta Conversion Event Job completed but event was not sent successfully', [
                    'deal_id' => $this->deal->id,
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                    'attempt' => $this->attempts(),
                ]);
                
                // Don't throw exception - we don't want to keep retrying if Meta API is consistently failing
                // The detailed error is already logged in MetaConversionsService
            }

        } catch (\Exception $e) {
            Log::error('Meta Conversion Event Job failed with exception', [
                'deal_id' => $this->deal->id,
                'event_name' => $this->eventName,
                'value' => $this->value,
                'attempt' => $this->attempts(),
                'exception_message' => $e->getMessage(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            // Don't rethrow the exception - fail gracefully
            // We don't want to block the queue or cause cascading failures
        }
    }

    /**
     * Handle a job failure.
     *
     * @param \Throwable $exception
     * @return void
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Meta Conversion Event Job failed permanently', [
            'deal_id' => $this->deal->id,
            'event_name' => $this->eventName,
            'exception_message' => $exception->getMessage(),
        ]);
    }
}

