<?php

namespace App\Email\Models;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

/**
 * A thread of messages joined by the reply graph. Linking a conversation to
 * a lead or deal is what projects its mail onto that record.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 */
class EmailConversation extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_conversations';

    protected $fillable = [
        'company_id',
    ];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function messages(): HasMany
    {
        return $this->hasMany(EmailMessage::class, 'conversation_id');
    }

    public function copies(): HasManyThrough
    {
        return $this->hasManyThrough(EmailMailboxCopy::class, EmailMessage::class, 'conversation_id', 'message_id');
    }

    public function links(): HasMany
    {
        return $this->hasMany(EmailRecordLink::class, 'conversation_id');
    }
}
