<?php

namespace App\Email\Models;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The canonical content of one email within a company: headers and bodies,
 * stored once however many mailboxes hold a copy of it.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property string|null $rfc_message_id
 * @property string|null $rfc_message_id_hash
 * @property string|null $in_reply_to
 * @property list<string>|null $reference_ids
 * @property list<string>|null $thread_keys
 * @property string|null $from_email
 * @property string|null $from_name
 * @property list<array{address: string, name: string|null}>|null $to_recipients
 * @property list<array{address: string, name: string|null}>|null $cc_recipients
 * @property list<array{address: string, name: string|null}>|null $reply_to_recipients
 * @property string|null $subject
 * @property \Illuminate\Support\Carbon|null $sent_at
 * @property string|null $text_body
 * @property string|null $html_raw
 * @property string|null $html_safe
 * @property bool $has_attachments
 * @property bool $is_partial
 */
class EmailMessage extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_messages';

    protected $fillable = [
        'company_id',
        'rfc_message_id',
        'rfc_message_id_hash',
        'in_reply_to',
        'reference_ids',
        'thread_keys',
        'from_email',
        'from_name',
        'to_recipients',
        'cc_recipients',
        'reply_to_recipients',
        'subject',
        'sent_at',
        'text_body',
        'html_raw',
        'html_safe',
        'has_attachments',
        'is_partial',
    ];

    protected $casts = [
        'reference_ids' => 'array',
        'thread_keys' => 'array',
        'to_recipients' => 'array',
        'cc_recipients' => 'array',
        'reply_to_recipients' => 'array',
        'sent_at' => 'datetime',
        'has_attachments' => 'boolean',
        'is_partial' => 'boolean',
    ];

    /** Unsanitized HTML is for the sanitizer only; it must never reach a browser. */
    protected $hidden = [
        'html_raw',
        'rfc_message_id_hash',
    ];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public static function hashRfcMessageId(?string $rfcMessageId): ?string
    {
        return $rfcMessageId !== null ? hash('sha256', $rfcMessageId) : null;
    }

    public function copies(): HasMany
    {
        return $this->hasMany(EmailMailboxCopy::class, 'message_id');
    }
}
