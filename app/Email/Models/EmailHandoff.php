<?php

namespace App\Email\Models;

use App\Email\Enums\HandoffStatus;
use App\Email\Enums\HandoffType;
use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Explicit handoff / escalate of a mailbox copy to another user. Never moves
 * mailbox ownership and never changes lead_owner.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property int $mailbox_copy_id
 * @property int|null $conversation_id
 * @property int $from_user_id
 * @property int $to_user_id
 * @property HandoffType $type
 * @property HandoffStatus $status
 * @property string|null $note
 * @property \Illuminate\Support\Carbon|null $resolved_at
 * @property int|null $resolved_by
 */
class EmailHandoff extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_handoffs';

    protected $fillable = [
        'company_id',
        'mailbox_copy_id',
        'conversation_id',
        'from_user_id',
        'to_user_id',
        'type',
        'status',
        'note',
        'resolved_at',
        'resolved_by',
    ];

    protected $casts = [
        'type' => HandoffType::class,
        'status' => HandoffStatus::class,
        'resolved_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => 'pending',
    ];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function copy(): BelongsTo
    {
        return $this->belongsTo(EmailMailboxCopy::class, 'mailbox_copy_id')->withoutGlobalScopes();
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id')->withoutGlobalScopes();
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id')->withoutGlobalScopes();
    }
}
