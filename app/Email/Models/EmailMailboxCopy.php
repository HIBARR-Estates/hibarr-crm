<?php

namespace App\Email\Models;

use App\Email\Data\MessageDirection;
use App\Email\Enums\ReviewStatus;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One mailbox's own copy of a message — the source of truth for who holds
 * it, where it sits in review, and that it is still theirs after an unlink.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property int $connection_id
 * @property int $message_id
 * @property string $provider_message_id
 * @property string|null $folder
 * @property MessageDirection $direction
 * @property ReviewStatus $review_status
 * @property list<array{address: string, name: string|null}>|null $bcc_recipients
 * @property list<array<string, mixed>>|null $provider_attachments
 */
class EmailMailboxCopy extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_mailbox_copies';

    protected $fillable = [
        'company_id',
        'connection_id',
        'message_id',
        'provider_message_id',
        'folder',
        'direction',
        'review_status',
        'bcc_recipients',
        'provider_attachments',
    ];

    protected $casts = [
        'direction' => MessageDirection::class,
        'review_status' => ReviewStatus::class,
        'bcc_recipients' => 'array',
        'provider_attachments' => 'array',
    ];

    protected $attributes = [
        'review_status' => 'none',
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

    public function message(): BelongsTo
    {
        return $this->belongsTo(EmailMessage::class, 'message_id')->withoutGlobalScopes();
    }
}
