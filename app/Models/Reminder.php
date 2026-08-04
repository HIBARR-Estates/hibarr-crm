<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reminder extends BaseModel
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_SCHEDULED = 'scheduled';
    public const STATUS_SENDING = 'sending';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    public const RECIPIENT_USER = 'user';
    public const RECIPIENT_LEAD = 'lead';
    public const RECIPIENT_EMAIL = 'email';

    public const ENTITY_MEETING = 'meeting';

    public const CHANNEL_EMAIL = 'email';

    protected $fillable = [
        'company_id',
        'entity_type',
        'entity_id',
        'remind_at',
        'status',
        'sent_at',
        'last_error',
        'channel',
        'recipient_type',
        'recipient_id',
        'recipient_email',
        'message',
        'created_by',
        'added_by',
        'last_updated_by',
    ];

    protected $casts = [
        'remind_at' => 'datetime',
        'sent_at' => 'datetime',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    /**
     * Atomically claim for send. Returns true if this caller won the claim.
     */
    public function claimForSending(): bool
    {
        $updated = self::query()
            ->where('id', $this->id)
            ->whereIn('status', [self::STATUS_PENDING, self::STATUS_SCHEDULED])
            ->update(['status' => self::STATUS_SENDING, 'updated_at' => now()]);

        if ($updated === 1) {
            $this->status = self::STATUS_SENDING;

            return true;
        }

        return false;
    }

    public function markSent(): void
    {
        $this->forceFill([
            'status' => self::STATUS_SENT,
            'sent_at' => now(),
            'last_error' => null,
        ])->save();
    }

    public function markFailed(string $error): void
    {
        $this->forceFill([
            'status' => self::STATUS_FAILED,
            'last_error' => mb_substr($error, 0, 2000),
        ])->save();
    }
}
