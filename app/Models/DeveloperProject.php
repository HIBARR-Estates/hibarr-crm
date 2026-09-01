<?php

namespace App\Models;

use App\Traits\HasCompany;
use App\Traits\HasOffers;
use App\Traits\HasTagPriorityAssetOrdering;
use App\Scopes\CompanyScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

/**
 * DeveloperProject Model
 * 
 * Represents a real estate development project. This is the central entity that:
 * - Has basic info (name, description)
 * - Belongs to a Developer (Many:1)
 * - Is tied to a ProjectLocation (1:1)
 * - Has an ExposeConfig for PDF generation (1:1)
 * - Contains multiple Properties (1:Many)
 * - Contains multiple DeveloperProjectAssets (1:Many)
 * - Stores construction project details (facilities, payment plans, distances, etc.)
 */
class DeveloperProject extends BaseModel
{
    use HasFactory, HasCompany, HasOffers, HasTagPriorityAssetOrdering, SoftDeletes;

    private const SLUG_SAVE_MAX_ATTEMPTS = 5;

    // ================================================================
    // Construction Status Constants (project-level)
    // ================================================================
    const CONSTRUCTION_STATUS_PRE_CONSTRUCTION = 'pre_construction';
    const CONSTRUCTION_STATUS_ACTIVE = 'active_construction';
    const CONSTRUCTION_STATUS_POST = 'post_construction';
    const CONSTRUCTION_STATUS_COMPLETE = 'complete';

    const CONSTRUCTION_STATUSES = [
        self::CONSTRUCTION_STATUS_PRE_CONSTRUCTION,
        self::CONSTRUCTION_STATUS_ACTIVE,
        self::CONSTRUCTION_STATUS_POST,
        self::CONSTRUCTION_STATUS_COMPLETE,
    ];

    const CONSTRUCTION_STATUS_LABELS = [
        self::CONSTRUCTION_STATUS_PRE_CONSTRUCTION => 'Pre-construction Phase',
        self::CONSTRUCTION_STATUS_ACTIVE => 'Active Construction',
        self::CONSTRUCTION_STATUS_POST => 'Post Construction',
        self::CONSTRUCTION_STATUS_COMPLETE => 'Complete',
    ];

    // ================================================================
    // Furniture Package Constants
    // ================================================================
    const FURNITURE_UNFURNISHED = 'unfurnished';
    const FURNITURE_PART_FURNISHED = 'part_furnished';
    const FURNITURE_WHITE_GOODS = 'white_goods_only';
    const FURNITURE_FULLY_FURNISHED = 'fully_furnished';

    const FURNITURE_PACKAGES = [
        self::FURNITURE_UNFURNISHED,
        self::FURNITURE_PART_FURNISHED,
        self::FURNITURE_WHITE_GOODS,
        self::FURNITURE_FULLY_FURNISHED,
    ];

    const FURNITURE_PACKAGE_LABELS = [
        self::FURNITURE_UNFURNISHED => 'Unfurnished',
        self::FURNITURE_PART_FURNISHED => 'Part Furnished',
        self::FURNITURE_WHITE_GOODS => 'White Goods Only',
        self::FURNITURE_FULLY_FURNISHED => 'Fully Furnished',
    ];

    // ================================================================
    // Unit Type Constants
    // ================================================================
    const UNIT_TYPES = [
        'apartment', 'villa', 'semi_detached_villa', 'bungalow',
        'townhouse', 'shop', 'office',
    ];

    const UNIT_TYPE_LABELS = [
        'apartment' => 'Apartment',
        'villa' => 'Villa',
        'semi_detached_villa' => 'Semi-Detached Villa',
        'bungalow' => 'Bungalow',
        'townhouse' => 'Townhouse',
        'shop' => 'Shop',
        'office' => 'Office',
    ];

    // ================================================================
    // Title Deed Type Constants
    // ================================================================
    const TITLE_DEED_TYPES = [
        'turkish', 'british', 'exchange', 'tahsis',
        'leasehold', 'mucahit',
    ];

    const TITLE_DEED_TYPE_LABELS = [
        'turkish' => 'Turkish',
        'british' => 'British',
        'exchange' => 'Exchange (Eşdeğer)',
        'tahsis' => 'Tahsis',
        'leasehold' => 'Leasehold',
        'mucahit' => 'Mücahit',
    ];

    // ================================================================
    // Facility Constants (deprecated — now stored in project_facilities table)
    // Keep for backward compatibility with any remaining references.
    // ================================================================

    protected $fillable = [
        'company_id',
        'developer_id',
        'name',
        'slug',
        'reference_code',
        'description',
        'project_location_id',
        // Per-project map pins (authoritative; location holds area defaults only)
        'map_url',
        'latitude',
        'longitude',
        'address',
        // Construction project fields
        'google_drive_link',
        'availability_link',
        'starting_price',
        'primary_categories',
        'title_deed_type',
        'unit_types',
        'number_of_units',
        'total_units',
        'total_units_sold',
        'number_of_blocks',
        'project_total_area_sqm',
        'construction_status',
        'completion_date',
        'number_of_phases',
        'furniture_package',
        'rental_guarantee',
        'payment_plan',
        'facilities',
        'distances',
        'is_hidden',
        'remind_at',
        'reminders',
    ];

    /**
     * Hidden from serialization to avoid collision with the `unit_types` column.
     * The `unitTypes()` HasMany relationship serializes as "unit_types" in JSON,
     * which overwrites the column value. Pass this relationship explicitly when needed.
     */
    protected $hidden = ['unitTypes'];

    protected $appends = [
        'formatted_starting_price',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'starting_price' => 'decimal:2',
        'project_total_area_sqm' => 'decimal:2',
        'number_of_units' => 'integer',
        'number_of_blocks' => 'integer',
        'number_of_phases' => 'integer',
        'rental_guarantee' => 'boolean',
        'completion_date' => 'date',
        'primary_categories' => 'array',
        'unit_types' => 'array',
        'payment_plan' => 'array',
        'facilities' => 'array',
        'distances' => 'array',
        'address' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'is_hidden' => 'boolean',
        'remind_at' => 'datetime',
        'reminders' => 'array',
    ];

    /**
     * Eager load these relations by default
     */
    protected $with = [];

    /**
     * Boot: generate unique slug from name on create/update when name is present.
     */
    protected static function booted(): void
    {
        // HasCompany also defines booted(); class method wins — re-apply CompanyScope here.
        static::addGlobalScope(new CompanyScope());

        static::saving(function (DeveloperProject $model) {
            if (empty($model->name)) {
                return;
            }
            $nameChanged = $model->isDirty('name');
            $slugEmpty = empty($model->slug);
            if ($slugEmpty || $nameChanged) {
                $model->slug = self::makeUniqueSlug(
                    $model->name,
                    $model->company_id ?? 0,
                    $model->id
                );
            }
        });
    }

    /**
     * Save the model. On unique constraint failure (slug), regenerate slug and retry.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        $attempt = 0;
        while (true) {
            try {
                $result = parent::save($options);

                return $result === true || $result === null ? true : (bool) $result;
            } catch (QueryException $e) {
                $isUniqueViolation = $e->getCode() === '23000'
                    || str_contains($e->getMessage(), 'Duplicate entry')
                    || str_contains($e->getMessage(), 'unique constraint')
                    || str_contains($e->getMessage(), 'UNIQUE constraint');
                if (!$isUniqueViolation || $attempt >= self::SLUG_SAVE_MAX_ATTEMPTS) {
                    throw $e;
                }
                $attempt++;
                $this->slug = self::makeUniqueSlug(
                    $this->name ?: 'project',
                    $this->company_id ?? 0,
                    $this->id
                );
            }
        }
    }

    /**
     * Generate a unique slug from name. If slug exists, append short random id.
     */
    public static function makeUniqueSlug(string $name, ?int $companyId = null, $excludeId = null): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'project';
        }
        $slug = $base;
        $attempt = 0;
        $query = static::query()->where('slug', $slug);
        if ($companyId !== null) {
            $query->where('company_id', $companyId);
        }
        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }
        while ($query->exists()) {
            $slug = $base . '-' . Str::lower(Str::random(4));
            $query = static::query()->where('slug', $slug);
            if ($companyId !== null) {
                $query->where('company_id', $companyId);
            }
            if ($excludeId !== null) {
                $query->where('id', '!=', $excludeId);
            }
            $attempt++;
            if ($attempt > 100) {
                $slug = $base . '-' . ($excludeId ?: Str::random(8));
                break;
            }
        }

        return $slug;
    }

    /**
     * Get formatted starting price with currency symbol.
     */
    public function getFormattedStartingPriceAttribute(): ?string
    {
        if (!$this->starting_price) return null;
        return $this->currency_symbol . number_format((float) $this->starting_price, 0);
    }


    /**
     * Get the developer that owns this project.
     * 
     * A project belongs to one developer, but a developer
     * can own multiple projects.
     */
    public function developer(): BelongsTo
    {
        return $this->belongsTo(Developer::class);
    }

    /**
     * Get the location associated with this project.
     * 
     * Each project has exactly one location that defines where
     * the project is situated and provides location details for exposes.
     */
    public function location(): BelongsTo
    {
        return $this->belongsTo(ProjectLocation::class, 'project_location_id');
    }

    /**
     * Nested location payload for APIs/CRM with per-project pin overlay.
     *
     * Project map_url / address / lat / lng win when set; otherwise fall back
     * to shared ProjectLocation defaults. Expose PDFs should keep using the
     * raw location relation (no overlay).
     *
     * @return array<string, mixed>|null
     */
    public function locationForApi(): ?array
    {
        if (!$this->relationLoaded('location')) {
            $this->load('location');
        }

        $location = $this->location;
        if (!$location) {
            return null;
        }

        $data = $location->toArray();

        $address = $this->address !== null ? $this->address : ($location->address ?? null);
        $mapUrl = $this->map_url !== null ? $this->map_url : ($location->map_url ?? null);
        $latitude = $this->latitude !== null ? $this->latitude : ($location->latitude ?? null);
        $longitude = $this->longitude !== null ? $this->longitude : ($location->longitude ?? null);

        $data['address'] = $address;
        $data['map_url'] = $mapUrl;
        $data['latitude'] = $latitude;
        $data['longitude'] = $longitude;
        $data['full_address'] = self::formatPinFullAddress(is_array($address) ? $address : null);

        return $data;
    }

    /**
     * Effective map URL for CRM links (project pin, then location default).
     */
    public function effectiveMapUrl(): ?string
    {
        if ($this->map_url !== null && $this->map_url !== '') {
            return $this->map_url;
        }

        return $this->location?->map_url;
    }

    /**
     * Effective street-level address for CRM display.
     *
     * @return array<string, mixed>|null
     */
    public function effectiveAddress(): ?array
    {
        if ($this->address !== null) {
            return $this->address;
        }

        $locationAddress = $this->location?->address;

        return is_array($locationAddress) ? $locationAddress : null;
    }

    /**
     * @param  array<string, mixed>|null  $address
     */
    public static function formatPinFullAddress(?array $address): string
    {
        if ($address === null) {
            return '';
        }

        $parts = array_filter([
            $address['street'] ?? null,
            $address['state'] ?? null,
            $address['country'] ?? null,
            $address['postalCode'] ?? null,
        ]);

        return implode(', ', $parts);
    }

    /**
     * Get the expose configuration for this project.
     * 
     * 1:1 relationship - each project has at most one expose config
     * that stores all data needed to generate the expose PDF.
     */
    public function exposeConfig(): HasOne
    {
        return $this->hasOne(DeveloperProjectExposeConfig::class);
    }

    /**
     * Get all properties belonging to this project.
     * 
     * A project can have many properties, but each property
     * can only belong to one project at a time.
     */
    public function properties(): HasMany
    {
        return $this->hasMany(Property::class);
    }

    /**
     * Get all assets (images, videos) belonging to this project.
     * 
     * Project-level assets are stored separately from property assets
     * and are used in expose generation.
     */
    public function assets(): HasMany
    {
        return $this->hasMany(DeveloperProjectAsset::class);
    }

    /**
     * Listing/card thumbnail: prefer cover-tagged images, then hero, then lowest order.
     */
    public function thumbnail(): HasOne
    {
        $table = (new DeveloperProjectAsset)->getTable();

        $relation = $this->hasOne(DeveloperProjectAsset::class)
            ->where("{$table}.asset_type", DeveloperProjectAsset::TYPE_IMAGE);

        return $relation
            ->orderByRaw($this->tagPriorityOrderSql($table))
            ->orderBy("{$table}.order");
    }

    /**
     * Get all unit types belonging to this project.
     * 
     * Each project can have multiple unit types (e.g., 2+1 Apartment, Studio Villa)
     * with their own specifications, features, pricing, and photos.
     */
    public function unitTypes(): HasMany
    {
        return $this->hasMany(DeveloperProjectUnitType::class);
    }

    /**
     * Check if project has an expose configuration.
     */
    public function hasExposeConfig(): bool
    {
        return $this->exposeConfig()->exists();
    }

    /**
     * Check if project has a location assigned.
     */
    public function hasLocation(): bool
    {
        return $this->project_location_id !== null;
    }

    /**
     * Get or create expose configuration.
     * 
     * Ensures the project always has an expose config when needed.
     * Creates a new empty config if one doesn't exist.
     * 
     * @return DeveloperProjectExposeConfig
     */
    public function getOrCreateExposeConfig(): DeveloperProjectExposeConfig
    {
        $config = $this->exposeConfig;
        
        if (!$config) {
            $config = $this->exposeConfig()->create([
                'developer_project_id' => $this->id,
            ]);
        }
        
        return $config;
    }

    /**
     * Get the count of properties in this project.
     */
    public function getPropertyCountAttribute(): int
    {
        return $this->properties()->count();
    }

    /**
     * Check if a property can be assigned to this project.
     * 
     * Currently always returns true, but can be extended to add
     * validation logic (e.g., location matching).
     */
    public function canAssignProperty(Property $property): bool
    {
        // Future: Add validation that property location matches project location
        return true;
    }

    /**
     * Assign multiple properties to this project.
     * 
     * @param array $propertyIds Array of property IDs to assign
     * @return int Number of properties updated
     */
    public function assignProperties(array $propertyIds): int
    {
        return Property::whereIn('id', $propertyIds)
            ->where('company_id', $this->company_id)
            ->update(['developer_project_id' => $this->id]);
    }

    /**
     * Remove properties from this project.
     * 
     * @param array $propertyIds Array of property IDs to remove
     * @return int Number of properties updated
     */
    public function removeProperties(array $propertyIds): int
    {
        return Property::whereIn('id', $propertyIds)
            ->where('developer_project_id', $this->id)
            ->update(['developer_project_id' => null]);
    }

    /**
     * Remove all properties from this project.
     * 
     * @return int Number of properties updated
     */
    public function removeAllProperties(): int
    {
        return $this->properties()->update(['developer_project_id' => null]);
    }

    /**
     * Generate a reference code for this project.
     * Pattern: DEVELOPERNAME-NNN
     * e.g., AKACAN-001
     *
     * @return string
     */
    public function generateReferenceCode(): string
    {
        $developer = $this->developer;
        $prefix = 'PRJ';

        if ($developer) {
            // Use first word of developer name, uppercase
            $words = explode(' ', trim($developer->name));
            $prefix = strtoupper($words[0]);
        }

        // Find the highest existing number for this prefix within the company.
        // Note: unique constraint is (company_id, reference_code), so we must
        // check ALL projects in the company with this prefix, not just same developer.
        // Use withTrashed() because the DB unique constraint includes soft-deleted rows.
        $maxCode = static::withTrashed()
            ->where('company_id', $this->company_id)
            ->where('id', '!=', $this->id ?? 0)
            ->whereNotNull('reference_code')
            ->where('reference_code', 'like', $prefix . '-%')
            ->pluck('reference_code')
            ->map(function ($code) use ($prefix) {
                // Extract numeric part after prefix (e.g., "AKACAN-002" → 2)
                $suffix = str_replace($prefix . '-', '', $code);
                // Only take the first numeric segment (ignore -UTxx suffixes)
                $parts = explode('-', $suffix);
                return is_numeric($parts[0]) ? (int) $parts[0] : 0;
            })
            ->max();

        $number = str_pad(($maxCode ?? 0) + 1, 3, '0', STR_PAD_LEFT);

        return $prefix . '-' . $number;
    }
}
