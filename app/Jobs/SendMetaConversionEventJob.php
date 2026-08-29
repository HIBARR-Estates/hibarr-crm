<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Models\Lead;
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
 * Queued either when a deal moves to a stage with a Meta conversion trigger
 * configured, or when a deal/lead automation runs a "Meta Conversion" action.
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
     * The deal or lead that triggered this event — a lead-subject automation
     * has no deal at all, so this accepts either.
     *
     * @var \App\Models\Deal|\App\Models\Lead
     */
    protected Deal|Lead $subject;

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
     * @param Deal|Lead $subject
     * @param string $eventName
     * @param float $value
     */
    public function __construct(Deal|Lead $subject, string $eventName, float $value = 0)
    {
        $this->subject = $subject;
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
        $logContext = $this->subject instanceof Lead
            ? ['lead_id' => $this->subject->id]
            : ['deal_id' => $this->subject->id];

        try {
            Log::info('Processing Meta Conversion Event Job', $logContext + [
                'event_name' => $this->eventName,
                'value' => $this->value,
                'attempt' => $this->attempts(),
            ]);

            // Send the event to Meta Conversions API
            $success = $metaService->sendEvent($this->eventName, $this->value, $this->subject);

            if ($success) {
                Log::info('Meta Conversion Event Job completed successfully', $logContext + [
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                ]);
            } else {
                Log::warning('Meta Conversion Event Job completed but event was not sent successfully', $logContext + [
                    'event_name' => $this->eventName,
                    'value' => $this->value,
                    'attempt' => $this->attempts(),
                ]);

                // Don't throw exception - we don't want to keep retrying if Meta API is consistently failing
                // The detailed error is already logged in MetaConversionsService
            }

        } catch (\Exception $e) {
            Log::error('Meta Conversion Event Job failed with exception', $logContext + [
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
        $logContext = $this->subject instanceof Lead
            ? ['lead_id' => $this->subject->id]
            : ['deal_id' => $this->subject->id];

        Log::error('Meta Conversion Event Job failed permanently', $logContext + [
            'event_name' => $this->eventName,
            'exception_message' => $exception->getMessage(),
        ]);
    }
}
