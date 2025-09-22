<?php

namespace App\Jobs;

use App\Models\ActivityResponseRetryQueue;
use App\Traits\ActivityResponseTrait;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ActivityResponseRetryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, ActivityResponseTrait;

    public $tries;
    public $maxExceptions;
    public $timeout;
    public $backoff;

    protected $retryQueueId;
    protected $originalData;
    protected $originalHeaders;
    protected $originalMaxRetries;
    protected $originalDelay;
    protected $originalTimeout;

    /**
     * Create a new job instance.
     */
    public function __construct(
        int $retryQueueId,
        array $originalData,
        array $originalHeaders = [],
        int $originalMaxRetries = 5,
        int $originalDelay = 10000,
        int $originalTimeout = 60
    ) {
        $this->retryQueueId = $retryQueueId;
        $this->originalData = $originalData;
        $this->originalHeaders = $originalHeaders;
        $this->originalMaxRetries = $originalMaxRetries;
        $this->originalDelay = $originalDelay;
        $this->originalTimeout = $originalTimeout;

        // Job configuration
        $this->tries = config('app.automations.retry_queue.max_job_retries', 3);
        $this->maxExceptions = config('app.automations.retry_queue.max_exceptions', 5);
        $this->timeout = config('app.automations.retry_queue.job_timeout', 300);
        $this->backoff = config('app.automations.retry_queue.job_backoff', [30, 60, 120]); // seconds
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $retryQueue = ActivityResponseRetryQueue::find($this->retryQueueId);
        
        if (!$retryQueue) {
            Log::error('RetryQueue record not found', ['retry_queue_id' => $this->retryQueueId]);
            return;
        }

        Log::info('Processing retry queue item', [
            'retry_queue_id' => $this->retryQueueId,
            'attempt' => $retryQueue->attempts + 1,
            'channel' => $this->originalData['channel'] ?? 'unknown'
        ]);

        try {
            // Attempt to send the activity
            $response = $this->sendActivityResponse(
                $this->originalData,
                $this->originalHeaders,
                1, // Only one attempt per job execution
                $this->originalDelay,
                $this->originalTimeout
            );

            if ($response && $response['success']) {
                // Success! Mark as completed and delete from queue
                Log::info('Retry successful, removing from queue', [
                    'retry_queue_id' => $this->retryQueueId,
                    'status_code' => $response['status_code']
                ]);
                
                $retryQueue->update([
                    'status' => 'completed',
                    'completed_at' => now(),
                    'last_response' => json_encode($response)
                ]);
                
                // Optionally delete the record after some time
                // $retryQueue->delete();
            } else {
                // Still failed, update attempts and schedule next retry
                $this->handleRetryFailure($retryQueue, $response);
            }

        } catch (\Exception $e) {
            Log::error('Exception during retry processing', [
                'retry_queue_id' => $this->retryQueueId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            $this->handleRetryFailure($retryQueue, [
                'status_code' => 0,
                'response' => $e->getMessage(),
                'success' => false
            ]);
        }
    }

    /**
     * Handle retry failure
     */
    protected function handleRetryFailure(RetryQueue $retryQueue, ?array $response): void
    {
        $maxRetries = config('app.automations.retry_queue.max_retries', 10);
        $newAttempts = $retryQueue->attempts + 1;

        if ($newAttempts >= $maxRetries) {
            // Max retries reached, mark as failed
            Log::error('Max retries reached, marking as failed', [
                'retry_queue_id' => $this->retryQueueId,
                'attempts' => $newAttempts
            ]);
            
            $retryQueue->update([
                'status' => 'failed',
                'attempts' => $newAttempts,
                'failed_at' => now(),
                'last_response' => $response ? json_encode($response) : null
            ]);
        } else {
            // Update attempts and schedule next retry
            $retryQueue->update([
                'attempts' => $newAttempts,
                'last_attempt_at' => now(),
                'next_retry_at' => $this->calculateNextRetryTime($newAttempts),
                'last_response' => $response ? json_encode($response) : null
            ]);

            // Schedule next retry
            $delay = $this->calculateRetryDelay($newAttempts);
            Log::info('Scheduling next retry', [
                'retry_queue_id' => $this->retryQueueId,
                'attempt' => $newAttempts,
                'delay_seconds' => $delay
            ]);

            ActivityResponseRetryJob::dispatch(
                $this->retryQueueId,
                $this->originalData,
                $this->originalHeaders,
                $this->originalMaxRetries,
                $this->originalDelay,
                $this->originalTimeout
            )->delay(now()->addSeconds($delay));
        }
    }

    /**
     * Calculate next retry time
     */
    protected function calculateNextRetryTime(int $attempt): \DateTime
    {
        $delay = $this->calculateRetryDelay($attempt);
        return now()->addSeconds($delay);
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    protected function calculateRetryDelay(int $attempt): int
    {
        $baseDelay = config('app.automations.retry_queue.base_delay_seconds', 60);
        $maxDelay = config('app.automations.retry_queue.max_delay_seconds', 3600);
        
        $delay = $baseDelay * pow(2, $attempt - 1);
        
        return min($delay, $maxDelay);
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('ActivityResponseRetryJob failed', [
            'retry_queue_id' => $this->retryQueueId,
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString()
        ]);

        $retryQueue = ActivityResponseRetryQueue::find($this->retryQueueId);
        if ($retryQueue) {
            $retryQueue->update([
                'status' => 'failed',
                'failed_at' => now(),
                'last_response' => json_encode([
                    'status_code' => 0,
                    'response' => 'Job failed: ' . $exception->getMessage(),
                    'success' => false
                ])
            ]);
        }
    }
}
