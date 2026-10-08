<?php

namespace App\Email\Models;

use App\Email\Enums\FollowableType;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Links a CRM task, note or meeting to the exact email message it was
 * created from. Mailbox ownership is unchanged; this is only a source pointer.
 *
 * @property int $id
 * @property int $company_id
 * @property int $message_id
 * @property FollowableType $followable_type
 * @property int $followable_id
 * @property int|null $created_by
 */
class EmailFollowUp extends BaseModel
{
    use HasCompany;

    protected $table = 'email_follow_ups';

    protected $fillable = [
        'company_id',
        'message_id',
        'followable_type',
        'followable_id',
        'created_by',
    ];

    protected $casts = [
        'followable_type' => FollowableType::class,
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(EmailMessage::class, 'message_id')->withoutGlobalScopes();
    }
}
