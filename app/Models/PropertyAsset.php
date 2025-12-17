<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class PropertyAsset extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    // Available asset types
    const TYPE_IMAGE = 'image';
    const TYPE_VIDEO = 'video';
    const TYPE_VIDEO_URL = 'video_url';
    const TYPE_TOUR_360_URL = 'tour_360_url';

    // Available tags for organizing assets
    const TAG_HERO = 'hero';
    const TAG_FACILITIES = 'facilities';
    const TAG_FEATURES = 'features';
    const TAG_AREA = 'area';
    const TAG_EXTERIOR = 'exterior';
    const TAG_INTERIOR = 'interior';
    const TAG_FLOOR_PLAN = 'floor-plan';
    const TAG_FOOTER = 'footer';
    const TAG_GALLERY = 'gallery';

    protected $fillable = [
        'property_id',
        'company_id',
        'name',
        'asset_type',
        'file_path',
        'external_url',
        'mime_type',
        'file_size',
        'tags',
        'metadata',
        'order',
    ];

    protected $casts = [
        'tags' => 'array',
        'metadata' => 'array',
        'file_size' => 'integer',
        'order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    protected $appends = ['url', 'formatted_size', 'has_tags'];

    /**
     * Relationships
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * Accessors
     */
    public function getUrlAttribute(): ?string
    {
        if ($this->external_url) {
            return $this->external_url;
        }

        if ($this->file_path) {
            // Construct URL directly for files in public/user-uploads
            $appUrl = rtrim(config('app.url'), '/');
            $uploadFolder = \App\Helper\Files::UPLOAD_FOLDER;
            return "{$appUrl}/{$uploadFolder}/{$this->file_path}";
        }

        return null;
    }

    public function getFormattedSizeAttribute(): ?string
    {
        if (!$this->file_size) {
            return null;
        }

        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = $this->file_size;
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    public function getHasTagsAttribute(): bool
    {
        return !empty($this->tags);
    }

    /**
     * Scopes
     */
    public function scopeImages($query)
    {
        return $query->where('asset_type', self::TYPE_IMAGE);
    }

    public function scopeVideos($query)
    {
        return $query->whereIn('asset_type', [self::TYPE_VIDEO, self::TYPE_VIDEO_URL]);
    }

    public function scopeByTag($query, string $tag)
    {
        return $query->whereJsonContains('tags', $tag);
    }

    public function scopeByTags($query, array $tags)
    {
        return $query->where(function ($q) use ($tags) {
            foreach ($tags as $tag) {
                $q->orWhereJsonContains('tags', $tag);
            }
        });
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('order', 'asc')->orderBy('created_at', 'desc');
    }

    public function scopeNewest($query)
    {
        return $query->orderBy('created_at', 'desc');
    }

    /**
     * Helper methods
     */
    public function hasTag(string $tag): bool
    {
        return in_array($tag, $this->tags ?? []);
    }

    public function addTag(string $tag): void
    {
        $tags = $this->tags ?? [];
        if (!in_array($tag, $tags)) {
            $tags[] = $tag;
            $this->tags = $tags;
            $this->save();
        }
    }

    public function removeTag(string $tag): void
    {
        $tags = $this->tags ?? [];
        $tags = array_filter($tags, fn($t) => $t !== $tag);
        $this->tags = array_values($tags);
        $this->save();
    }

    public function isImage(): bool
    {
        return $this->asset_type === self::TYPE_IMAGE;
    }

    public function isVideo(): bool
    {
        return in_array($this->asset_type, [self::TYPE_VIDEO, self::TYPE_VIDEO_URL]);
    }

    public function isExternal(): bool
    {
        return !empty($this->external_url);
    }

    /**
     * Get all available tags
     */
    public static function getAvailableTags(): array
    {
        return [
            self::TAG_HERO => 'Hero Image',
            self::TAG_FACILITIES => 'Facilities',
            self::TAG_FEATURES => 'Features',
            self::TAG_AREA => 'Area/Location',
            self::TAG_EXTERIOR => 'Exterior',
            self::TAG_INTERIOR => 'Interior',
            self::TAG_FLOOR_PLAN => 'Floor Plan',
            self::TAG_FOOTER => 'Footer',
            self::TAG_GALLERY => 'Gallery',
        ];
    }

    /**
     * Get all available asset types
     */
    public static function getAvailableTypes(): array
    {
        return [
            self::TYPE_IMAGE => 'Image',
            self::TYPE_VIDEO => 'Video',
            self::TYPE_VIDEO_URL => 'Video URL',
            self::TYPE_TOUR_360_URL => '360° Tour URL',
        ];
    }
}
