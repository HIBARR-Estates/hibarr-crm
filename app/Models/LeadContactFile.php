<?php

namespace App\Models;

use App\Traits\IconTrait;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Freeform file attachment on a lead contact (not a deal).
 *
 * @property int $id
 * @property int $lead_id
 * @property int $user_id
 * @property string $filename
 * @property string $hashname
 * @property string|null $size
 * @property string|null $description
 * @property string|null $external_url
 * @property string|null $object_path
 * @property int|null $added_by
 * @property int|null $last_updated_by
 */
class LeadContactFile extends BaseModel
{
    use IconTrait;

    public const FILE_PATH = 'lead-contact-files';

    protected $table = 'lead_contact_files';

    protected $fillable = [
        'lead_id',
        'user_id',
        'filename',
        'hashname',
        'size',
        'description',
        'external_url',
        'object_path',
        'added_by',
        'last_updated_by',
    ];

    protected $guarded = ['id'];

    protected $appends = ['file_url', 'icon'];

    public function getFileUrlAttribute()
    {
        if (!empty($this->external_url)) {
            return $this->external_url;
        }

        return asset_url_local_s3(
            self::FILE_PATH . '/' . $this->lead_id . '/' . $this->hashname
        );
    }

    public function isExternallyStored(): bool
    {
        return !empty($this->external_url);
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }
}
