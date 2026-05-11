<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyExposeConfiguration extends BaseModel
{
    use HasFactory;

    public const FILE_PATH = 'company-expose-config';

    protected $fillable = [
        'company_id',
        'outro_enabled',
        'outro_title',
        'outro_description',
        'outro_primary_image',
        'outro_secondary_image',
        'qr_enabled',
        'qr_code_link',
    ];

    protected $casts = [
        'outro_enabled' => 'boolean',
        'qr_enabled' => 'boolean',
    ];

    protected $appends = [
        'outro_primary_image_url',
        'outro_secondary_image_url',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function getOutroPrimaryImageUrlAttribute(): ?string
    {
        if (empty($this->outro_primary_image)) {
            return null;
        }

        return asset_url(self::FILE_PATH . '/' . $this->outro_primary_image);
    }

    public function getOutroSecondaryImageUrlAttribute(): ?string
    {
        if (empty($this->outro_secondary_image)) {
            return null;
        }

        return asset_url(self::FILE_PATH . '/' . $this->outro_secondary_image);
    }
}
