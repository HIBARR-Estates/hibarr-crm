<?php

namespace App\Email\Models;

use App\Email\Enums\LinkableType;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Projects a conversation onto one lead or deal. Removing the row removes the
 * projection only — messages and mailbox copies are untouched.
 *
 * @property int $id
 * @property int $company_id
 * @property int $conversation_id
 * @property LinkableType $linkable_type
 * @property int $linkable_id
 * @property int|null $linked_by
 * @property \Illuminate\Support\Carbon|null $linked_at
 */
class EmailRecordLink extends BaseModel
{
    use HasCompany;

    protected $table = 'email_record_links';

    protected $fillable = [
        'company_id',
        'conversation_id',
        'linkable_type',
        'linkable_id',
        'linked_by',
        'linked_at',
    ];

    protected $casts = [
        'linkable_type' => LinkableType::class,
        'linked_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(EmailConversation::class, 'conversation_id')->withoutGlobalScopes();
    }
}
