<?php

namespace App\Email\Models;

use App\Email\Enums\FileScanStatus;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An email attachment held by the CRM: received with a message, or uploaded
 * to be sent. Lives under its own storage prefix and is not a lead or deal
 * file — it never appears on the CRM Files tab.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property int|null $message_id
 * @property int|null $connection_id
 * @property int|null $uploaded_by
 * @property string|null $part_id
 * @property string $filename
 * @property string|null $mime_type
 * @property int|null $size_bytes
 * @property string|null $content_id
 * @property bool $inline
 * @property string|null $storage_key
 * @property string|null $storage_url
 * @property FileScanStatus $scan_status
 * @property string|null $error_code
 */
class EmailFile extends BaseModel
{
    use HasCompany;
    use HasUuids;

    protected $table = 'email_files';

    protected $fillable = [
        'company_id',
        'message_id',
        'connection_id',
        'uploaded_by',
        'part_id',
        'filename',
        'mime_type',
        'size_bytes',
        'content_id',
        'inline',
        'storage_key',
        'storage_url',
        'scan_status',
        'error_code',
    ];

    protected $casts = [
        'inline' => 'boolean',
        'size_bytes' => 'integer',
        'scan_status' => FileScanStatus::class,
    ];

    /** Where the bytes live is the server's business; downloads go through the CRM. */
    protected $hidden = [
        'storage_key',
        'storage_url',
    ];

    protected $attributes = [
        'scan_status' => 'pending',
    ];

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(EmailMessage::class, 'message_id')->withoutGlobalScopes();
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(EmailConnection::class, 'connection_id')->withoutGlobalScopes();
    }

    public function isStored(): bool
    {
        return $this->storage_key !== null && $this->storage_url !== null;
    }
}
