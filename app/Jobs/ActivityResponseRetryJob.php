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
    protected $originalTimeout;

    /**
     * Create a new job instance.
     */
    public function __construct(
        int $retryQueueId,
        array $originalData,
        array $originalHeaders = [],
        int $originalTimeout = 60
    ) {
        $this->retryQueueId = $retryQueueId;
        $this->originalData = $originalData;
        $this->originalHeaders = $originalHeaders;
        $this->originalTimeout = $originalTimeout;

        // Job configuration
        $this->tries = 3;
        $this->maxExceptions = 5;
        $this->timeout = 300;
        $this->backoff = [30, 60, 120]; // seconds
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
    protected function handleRetryFailure(ActivityResponseRetryQueue $retryQueue, ?array $response): void
    {
        $maxRetries = 10;
        $newAttempts = $retryQueue->attempts + 1;

        if ($newAttempts >= $maxRetries) {
            // Max retries reached, mark as failed
            Log::error('Max retries reached, marking as failed', [
                'retry_queue_id' => $this->retryQueueId,
                'attempts' => $newAttempts
            ]);
            
            // Check if N8N is unreachable and add notification to queue
            $this->handleMaxRetriesReached($retryQueue, $response);
            
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

            // Schedule next retry (let the scheduler handle it)
            $delay = $this->calculateRetryDelay($newAttempts);
            Log::info('Scheduled next retry', [
                'retry_queue_id' => $this->retryQueueId,
                'attempt' => $newAttempts,
                'delay_seconds' => $delay,
                'next_retry_at' => $retryQueue->next_retry_at
            ]);
        }
    }

    /**
     * Handle when max retries are reached
     */
    protected function handleMaxRetriesReached(ActivityResponseRetryQueue $retryQueue, ?array $response): void
    {
        $isN8NUnreachable = $this->isN8NUnreachable($response);
        
        if ($isN8NUnreachable) {
            $this->addN8NUnreachableNotification($retryQueue, $response);
        }
    }

    /**
     * Check if N8N is unreachable based on response
     */
    protected function isN8NUnreachable(?array $response): bool
    {
        if (!$response) {
            return true; // No response means unreachable
        }

        $statusCode = $response['status_code'] ?? 0;
        
        // Check for common unreachable scenarios
        $unreachableStatusCodes = [0, 404, 500, 502, 503, 504];
        $unreachableMessages = [
            'webhook not registered',
            'connection refused',
            'timeout',
            'unreachable',
            'not found',
            'internal server error'
        ];

        // Check status code
        if (in_array($statusCode, $unreachableStatusCodes)) {
            return true;
        }

        // Check response message for unreachable indicators
        $responseText = $response['response'] ?? '';
        if (is_string($responseText)) {
            foreach ($unreachableMessages as $message) {
                if (stripos($responseText, $message) !== false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Add notification to queue when N8N is unreachable
     */
    protected function addN8NUnreachableNotification(ActivityResponseRetryQueue $retryQueue, ?array $response): void
    {
        try {
            $channel = $retryQueue->channel ?? 'unknown';
            $originalData = $retryQueue->original_data ?? [];
            
            // Create notification data
            $notificationData = [
                'channel' => 'system_notification',
                'message' => "N8N webhook unreachable after {$retryQueue->attempts} attempts. Activity response failed for {$channel} channel.",
                'title' => 'N8N Webhook Unreachable',
                'priority' => 'high',
                'retry_queue_id' => $retryQueue->id,
                'original_channel' => $channel,
                'original_data' => $originalData,
                'last_response' => $response,
                'failed_at' => now()->toISOString(),
                'attempts' => $retryQueue->attempts
            ];

            // Add to retry queue as a notification
            ActivityResponseRetryQueue::create([
                'original_data' => $notificationData,
                'original_headers' => [],
                'channel' => 'system_notification',
                'status' => 'pending',
                'attempts' => 0,
                'next_retry_at' => now()->addMinutes(5), // Retry notification after 5 minutes
                'last_response' => null
            ]);

            Log::error('N8N unreachable notification added to queue', [
                'retry_queue_id' => $retryQueue->id,
                'channel' => $channel,
                'attempts' => $retryQueue->attempts,
                'notification_data' => $notificationData
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to add N8N unreachable notification', [
                'retry_queue_id' => $retryQueue->id,
                'error' => $e->getMessage()
            ]);
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
        $baseDelay = 60;
        $maxDelay = 3600;
        
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
