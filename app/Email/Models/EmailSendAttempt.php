<?php

namespace App\Email\Models;

use App\Email\Data\Draft;
use App\Email\Enums\SendAttemptStatus;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One outbound message and everything that has happened to it. Retries
 * update this row; they never create another one.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property int $connection_id
 * @property int|null $created_by
 * @property array<string, mixed> $draft_payload
 * @property string|null $rfc_message_id
 * @property SendAttemptStatus $status
 * @property string|null $provider_submission_id
 * @property string|null $error_code
 * @property int $attempt_count
 * @property \Illuminate\Support\Carbon|null $last_attempted_at
 * @property \Illuminate\Support\Carbon|null $next_attempt_at
 * @property \Illuminate\Support\Carbon|null $sent_at
 */
class EmailSendAttempt extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_send_attempts';

    protected $fillable = [
        'company_id',
        'connection_id',
        'created_by',
        'draft_payload',
        'rfc_message_id',
        'status',
        'provider_submission_id',
        'error_code',
        'attempt_count',
        'last_attempted_at',
        'next_attempt_at',
        'sent_at',
    ];

    protected $casts = [
        'draft_payload' => 'array',
        'status' => SendAttemptStatus::class,
        'attempt_count' => 'integer',
        'last_attempted_at' => 'datetime',
        'next_attempt_at' => 'datetime',
        'sent_at' => 'datetime',
    ];

    /** Holds the message body; expose it deliberately, never by default. */
    protected $hidden = [
        'draft_payload',
    ];

    protected $attributes = [
        'status' => 'sending',
        'attempt_count' => 0,
    ];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(EmailConnection::class, 'connection_id')->withoutGlobalScopes();
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailSendRecipient::class, 'send_attempt_id');
    }

    public function draft(): Draft
    {
        return Draft::fromArray($this->draft_payload);
    }
}
