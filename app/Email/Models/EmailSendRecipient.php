<?php

namespace App\Email\Models;

use App\Email\Enums\SendRecipientKind;
use App\Email\Enums\SendRecipientStatus;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $company_id
 * @property int $send_attempt_id
 * @property string $address
 * @property string|null $name
 * @property SendRecipientKind $kind
 * @property SendRecipientStatus $status
 */
class EmailSendRecipient extends BaseModel
{
    use HasCompany;

    protected $table = 'email_send_recipients';

    protected $fillable = [
        'company_id',
        'send_attempt_id',
        'address',
        'name',
        'kind',
        'status',
    ];

    protected $casts = [
        'kind' => SendRecipientKind::class,
        'status' => SendRecipientStatus::class,
    ];

    protected $attributes = [
        'status' => 'pending',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(EmailSendAttempt::class, 'send_attempt_id')->withoutGlobalScopes();
    }
}
