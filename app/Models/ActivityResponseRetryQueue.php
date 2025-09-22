<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;

class ActivityResponseRetryQueue extends Model
{
    use HasFactory;

    protected $table = 'activity_response_retry_queue';

    protected $fillable = [
        'original_data',
        'original_headers',
        'channel',
        'status',
        'attempts',
        'last_attempt_at',
        'next_retry_at',
        'completed_at',
        'failed_at',
        'last_response',
        'error_message'
    ];

    protected $casts = [
        'original_data' => 'array',
        'original_headers' => 'array',
        'last_response' => 'array',
        'last_attempt_at' => 'datetime',
        'next_retry_at' => 'datetime',
        'completed_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    protected $dates = [
        'last_attempt_at',
        'next_retry_at',
        'completed_at',
        'failed_at',
        'created_at',
        'updated_at'
    ];

    // Status constants
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /**
     * Scope for pending items ready for retry
     */
    public function scopeReadyForRetry($query)
    {
        return $query->where('status', self::STATUS_PENDING)
                    ->where(function($q) {
                        $q->whereNull('next_retry_at')
                          ->orWhere('next_retry_at', '<=', now());
                    });
    }

    /**
     * Scope for failed items
     */
    public function scopeFailed($query)
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Scope for completed items
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope for specific channel
     */
    public function scopeForChannel($query, $channel)
    {
        return $query->where('channel', $channel);
    }

    /**
     * Check if item is ready for retry
     */
    public function isReadyForRetry(): bool
    {
        return $this->status === self::STATUS_PENDING && 
               ($this->next_retry_at === null || $this->next_retry_at <= now());
    }

    /**
     * Check if item has exceeded max retries
     */
    public function hasExceededMaxRetries(int $maxRetries = null): bool
    {
        $maxRetries = $maxRetries ?? config('app.automations.retry_queue.max_retries', 10);
        return $this->attempts >= $maxRetries;
    }

    /**
     * Mark as processing
     */
    public function markAsProcessing(): void
    {
        $this->update([
            'status' => self::STATUS_PROCESSING,
            'last_attempt_at' => now()
        ]);
    }

    /**
     * Mark as completed
     */
    public function markAsCompleted(array $response = null): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'completed_at' => now(),
            'last_response' => $response
        ]);
    }

    /**
     * Mark as failed
     */
    public function markAsFailed(array $response = null, string $errorMessage = null): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'failed_at' => now(),
            'last_response' => $response,
            'error_message' => $errorMessage
        ]);
    }

    /**
     * Increment attempts and schedule next retry
     */
    public function scheduleNextRetry(int $delay = null): void
    {
        $delay = $delay ?? $this->calculateRetryDelay();
        $this->update([
            'attempts' => $this->attempts + 1,
            'last_attempt_at' => now(),
            'next_retry_at' => now()->addSeconds($delay)
        ]);
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    public function calculateRetryDelay(): int
    {
        $baseDelay = config('app.automations.retry_queue.base_delay_seconds', 60);
        $maxDelay = config('app.automations.retry_queue.max_delay_seconds', 3600);
        
        $delay = $baseDelay * pow(2, $this->attempts);
        
        return min($delay, $maxDelay);
    }

    /**
     * Get the channel from original data
     */
    protected function channel(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => $value ?? ($this->original_data['channel'] ?? null)
        );
    }
}
