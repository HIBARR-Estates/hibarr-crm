<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DeveloperProjectUnitTypeAsset Model
 * 
 * Represents an asset (image, video) belonging to a unit type within a developer project.
 * Follows the same pattern as DeveloperProjectAsset and PropertyAsset.
 */
class DeveloperProjectUnitTypeAsset extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'developer_project_unit_type_assets';

    // Available asset types
    const TYPE_IMAGE = 'image';
    const TYPE_VIDEO = 'video';
    const TYPE_VIDEO_URL = 'video_url';

    // Available tags for organizing assets
    const TAG_COVER = 'cover';
    const TAG_HERO = 'hero';
    const TAG_INTERIOR = 'interior';
    const TAG_EXTERIOR = 'exterior';
    const TAG_FLOOR_PLAN = 'floor-plan';
    const TAG_GALLERY = 'gallery';
    const TAG_FACILITIES = 'facilities';
    const TAG_FEATURES = 'features';
    const TAG_AREA = 'area';
    const TAG_SITE_PLAN = 'site-plan';
    const TAG_FOOTER = 'footer';

    const AVAILABLE_TAGS = [
        self::TAG_COVER => 'Cover Photo',
        self::TAG_HERO => 'Hero',
        self::TAG_INTERIOR => 'Interior',
        self::TAG_EXTERIOR => 'Exterior',
        self::TAG_FLOOR_PLAN => 'Floor Plan',
        self::TAG_GALLERY => 'Gallery',
        self::TAG_FACILITIES => 'Facilities',
        self::TAG_FEATURES => 'Features',
        self::TAG_AREA => 'Area / Location',
        self::TAG_SITE_PLAN => 'Site Plan',
        self::TAG_FOOTER => 'Footer',
    ];

    protected $fillable = [
        'unit_type_id',
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
    ];

    protected $appends = ['url'];

    // ================================================================
    // Relationships
    // ================================================================

    /**
     * The unit type this asset belongs to.
     */
    public function unitType(): BelongsTo
    {
        return $this->belongsTo(DeveloperProjectUnitType::class, 'unit_type_id');
    }

    // ================================================================
    // Accessors
    // ================================================================

    /**
     * Get the full URL for the asset.
     */
    public function getUrlAttribute(): ?string
    {
        if ($this->external_url) {
            return $this->external_url;
        }

        if ($this->file_path) {
            // Check if it's already a full URL
            if (str_starts_with($this->file_path, 'http')) {
                return $this->file_path;
            }

            return asset('storage/' . $this->file_path);
        }

        return null;
    }

    // ================================================================
    // Scopes
    // ================================================================

    /**
     * Filter to only images.
     */
    public function scopeImages($query)
    {
        return $query->where('asset_type', self::TYPE_IMAGE);
    }

    /**
     * Filter to only videos.
     */
    public function scopeVideos($query)
    {
        return $query->whereIn('asset_type', [self::TYPE_VIDEO, self::TYPE_VIDEO_URL]);
    }

    /**
     * Filter by tag.
     */
    public function scopeByTag($query, string $tag)
    {
        return $query->whereJsonContains('tags', $tag);
    }

    /**
     * Filter by multiple tags (any match).
     */
    public function scopeByTags($query, array $tags)
    {
        return $query->where(function ($q) use ($tags) {
            foreach ($tags as $tag) {
                $q->orWhereJsonContains('tags', $tag);
            }
        });
    }

    /**
     * Order by the order column.
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order')->orderBy('id');
    }
}
