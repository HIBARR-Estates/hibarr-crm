<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use App\Casts\PriceCast;

class Property extends BaseModel
{
    use HasFactory, HasCompany;

    // Property categories based on TypeScript enum
    const CATEGORY_HOUSING = 'housing';
    const CATEGORY_LAND = 'land';
    const CATEGORY_COMMERCIAL = 'commercial';

    // Sale types based on TypeScript enum
    const SALE_TYPE_FOR_SALE = 'For Sale';
    const SALE_TYPE_FOR_RENT = 'For Rent';
    const SALE_TYPE_DAILY_RENTAL = 'For Daily Rental';

    // Status types
    const STATUS_AVAILABLE = 'Available';
    const STATUS_UNDER_OFFER = 'Under offer';
    const STATUS_SOLD = 'Sold';
    const STATUS_WITHDRAWN = 'Withdrawn';

    // Rent payment intervals
    const RENT_PAYMENT_MONTHLY = 'monthly';
    const RENT_PAYMENT_QUARTERLY = 'quarterly';
    const RENT_PAYMENT_YEARLY = 'yearly';

    // Title Deed Types
    const TITLE_DEED_EXCHANGE = 'Exchange Title Deed';
    const TITLE_DEED_TURKISH = 'Turkish Title Deed';
    const TITLE_DEED_BRITISH = 'British Title Deed';
    const TITLE_DEED_TAHSIS = 'Tahsis Title Deed';
    const TITLE_DEED_MUJAHIT = 'Mujahit Title Deed';
    // Additional deed types from frontend
    const TITLE_DEED_FREEHOLD = 'Freehold';
    const TITLE_DEED_LEASEHOLD = 'Leasehold';
    const TITLE_DEED_EXCHANGE_KAT = 'Exchange (Kat Irtifakı)';
    const TITLE_DEED_FULL_OWNERSHIP = 'Full Ownership (Kat Mülkiyeti)';
    const TITLE_DEED_SHARED = 'Shared Title';
    const TITLE_DEED_FLOOR_EASEMENT = 'Floor Easement';
    const TITLE_DEED_LAND_REGISTRY = 'Land Registry';

    // Title Deed Stages
    const TITLE_DEED_STAGE_LAND = 'Land Title Deed';
    const TITLE_DEED_STAGE_SHARED = 'Shared Holder Title Deed';
    const TITLE_DEED_STAGE_INDIVIDUAL = 'Individual Title Deed';
    const TITLE_DEED_STAGE_KAT_IRTIRFAKLI = 'Individiual (Kat Irtirfakli) Title Deed';
    // Additional deed statuses from frontend
    const TITLE_DEED_STAGE_READY = 'Ready';
    const TITLE_DEED_STAGE_IN_PROGRESS = 'In Progress';
    const TITLE_DEED_STAGE_PENDING = 'Pending';
    const TITLE_DEED_STAGE_APPLIED = 'Applied';
    const TITLE_DEED_STAGE_UNDER_REVIEW = 'Under Review';

    // Furniture Status
    const FURNITURE_UNFURNISHED = 'Unfurnished';
    const FURNITURE_FULLY_FURNISHED = 'Fully Furnished';
    const FURNITURE_FURNISHED = 'Furnished';
    const FURNITURE_SEMI_FURNISHED = 'Semi-Furnished';
    const FURNITURE_PART_FURNISHED = 'Part Furnished';
    const FURNITURE_WHITE_GOODS_ONLY = 'White Goods Only';

    // Property Types
    const PROPERTY_TYPE_VILLA = 'Villa';
    const PROPERTY_TYPE_TWIN_VILLA = 'Twin Villa';
    const PROPERTY_TYPE_APARTMENT = 'Apartment';
    const PROPERTY_TYPE_FAMILY_HOME = 'Family Home';
    const PROPERTY_TYPE_TOWNHOUSE = 'Townhouse';
    const PROPERTY_TYPE_LOFT = 'Loft';
    const PROPERTY_TYPE_PENTHOUSE = 'Penthouse';
    const PROPERTY_TYPE_BUNGALOW = 'Bungalow';
    const PROPERTY_TYPE_COMMERCIAL_PROPERTY = 'Commercial Property';
    const PROPERTY_TYPE_BLOCK_APARTMENTS = 'Block of apartments';
    const PROPERTY_TYPE_COMPLETE_BUILDING = 'Complete Building';
    const PROPERTY_TYPE_ABANDONED_BUILDING = 'Abandoned Building';
    const PROPERTY_TYPE_RESIDENCE = 'Residence';
    const PROPERTY_TYPE_HALF_CONSTRUCTION = 'Half Construction';
    const PROPERTY_TYPE_TIME_SHARE = 'Time Share';
    const PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND = 'Residentially Zoned Land';
    const PROPERTY_TYPE_FIELD = 'Field';
    const PROPERTY_TYPE_RESIDENTIAL_COMMERCIAL_LAND = 'Residentially and Commercially Zoned Land';
    const PROPERTY_TYPE_COMMERCIALLY_ZONED_LAND = 'Commercially Zoned Land';
    const PROPERTY_TYPE_INDUSTRIALLY_ZONED_LAND = 'Industrially Zoned land';
    const PROPERTY_TYPE_TOURISM_ZONED_LAND = 'Tourism Zoned Land';
    const PROPERTY_TYPE_OLIVE_GROVE = 'Olive Grove';
    const PROPERTY_TYPE_SHOP = 'Shop';
    const PROPERTY_TYPE_HOTEL = 'Hotel';
    const PROPERTY_TYPE_WORKPLACE = 'Workplace';
    const PROPERTY_TYPE_WAREHOUSE = 'Warehouse';
    const PROPERTY_TYPE_WORKPLACE_FOR_SALE = 'Workplace for sale';
    const PROPERTY_TYPE_OFFICE = 'Office';

    // ================================================================
    // Reference Code Mapping - Property Type Codes
    // ================================================================
    const TYPE_CODES = [
        self::PROPERTY_TYPE_APARTMENT => 'APT',
        self::PROPERTY_TYPE_VILLA => 'VIL',
        self::PROPERTY_TYPE_TWIN_VILLA => 'SMV',
        self::PROPERTY_TYPE_BUNGALOW => 'BNG',
        self::PROPERTY_TYPE_TOWNHOUSE => 'TWN',
        self::PROPERTY_TYPE_COMPLETE_BUILDING => 'BLD',
        self::PROPERTY_TYPE_ABANDONED_BUILDING => 'RUN',
        self::PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND => 'LND',
        self::PROPERTY_TYPE_FIELD => 'LND',
        self::PROPERTY_TYPE_RESIDENTIAL_COMMERCIAL_LAND => 'LND',
        self::PROPERTY_TYPE_COMMERCIALLY_ZONED_LAND => 'LND',
        self::PROPERTY_TYPE_INDUSTRIALLY_ZONED_LAND => 'LND',
        self::PROPERTY_TYPE_TOURISM_ZONED_LAND => 'LND',
        self::PROPERTY_TYPE_OLIVE_GROVE => 'LND',
        self::PROPERTY_TYPE_PENTHOUSE => 'APT',
        self::PROPERTY_TYPE_LOFT => 'APT',
        self::PROPERTY_TYPE_FAMILY_HOME => 'VIL',
        self::PROPERTY_TYPE_RESIDENCE => 'APT',
        self::PROPERTY_TYPE_BLOCK_APARTMENTS => 'BLD',
        self::PROPERTY_TYPE_HALF_CONSTRUCTION => 'BLD',
        self::PROPERTY_TYPE_COMMERCIAL_PROPERTY => 'COM',
        self::PROPERTY_TYPE_SHOP => 'SHP',
        self::PROPERTY_TYPE_HOTEL => 'HTL',
        self::PROPERTY_TYPE_WORKPLACE => 'WRK',
        self::PROPERTY_TYPE_WAREHOUSE => 'WHS',
        self::PROPERTY_TYPE_WORKPLACE_FOR_SALE => 'WRK',
        self::PROPERTY_TYPE_OFFICE => 'OFC',
        self::PROPERTY_TYPE_TIME_SHARE => 'TSH',
    ];

    // ================================================================
    // Reference Code Mapping - Unit Style/Subtype Codes
    // ================================================================
    const UNIT_STYLE_STANDARD = 'standard';
    const UNIT_STYLE_PENTHOUSE = 'penthouse';
    const UNIT_STYLE_LOFT = 'loft';
    const UNIT_STYLE_GARDEN = 'garden';
    const UNIT_STYLE_DUPLEX = 'duplex';
    const UNIT_STYLE_TRIPLEX = 'triplex';
    const UNIT_STYLE_STUDIO = 'studio';

    const SUBTYPE_CODES = [
        self::UNIT_STYLE_STANDARD => 'STD',
        self::UNIT_STYLE_PENTHOUSE => 'PEN',
        self::UNIT_STYLE_LOFT => 'LFT',
        self::UNIT_STYLE_GARDEN => 'GRD',
        self::UNIT_STYLE_DUPLEX => 'DPL',
        self::UNIT_STYLE_TRIPLEX => 'TPL',
        self::UNIT_STYLE_STUDIO => 'STU',
    ];

    const UNIT_STYLES = [
        self::UNIT_STYLE_STANDARD,
        self::UNIT_STYLE_PENTHOUSE,
        self::UNIT_STYLE_LOFT,
        self::UNIT_STYLE_GARDEN,
        self::UNIT_STYLE_DUPLEX,
        self::UNIT_STYLE_TRIPLEX,
        self::UNIT_STYLE_STUDIO,
    ];

    // ================================================================
    // Primary Categories (new)
    // ================================================================
    const PRIMARY_CATEGORY_RESIDENTIAL = 'residential';
    const PRIMARY_CATEGORY_COMMERCIAL = 'commercial';
    const PRIMARY_CATEGORY_LAND = 'land';

    const PRIMARY_CATEGORIES = [
        self::PRIMARY_CATEGORY_RESIDENTIAL,
        self::PRIMARY_CATEGORY_COMMERCIAL,
        self::PRIMARY_CATEGORY_LAND,
    ];

    // ================================================================
    // Construction Status
    // ================================================================
    const CONSTRUCTION_STATUS_OFF_PLAN = 'off_plan';
    const CONSTRUCTION_STATUS_UNDER_CONSTRUCTION = 'under_construction';
    const CONSTRUCTION_STATUS_COMPLETED_NEW = 'completed_new';
    const CONSTRUCTION_STATUS_RESALE = 'resale';
    const CONSTRUCTION_STATUS_RUIN_RENOVATION = 'ruin_renovation';

    const CONSTRUCTION_STATUSES = [
        self::CONSTRUCTION_STATUS_OFF_PLAN,
        self::CONSTRUCTION_STATUS_UNDER_CONSTRUCTION,
        self::CONSTRUCTION_STATUS_COMPLETED_NEW,
        self::CONSTRUCTION_STATUS_RESALE,
        self::CONSTRUCTION_STATUS_RUIN_RENOVATION,
    ];

    // ================================================================
    // View Types (multi-select)
    // ================================================================
    const VIEW_TYPE_SEA_FRONT = 'sea_front';
    const VIEW_TYPE_SEA_VIEW = 'sea_view';
    const VIEW_TYPE_MOUNTAIN_VIEW = 'mountain_view';
    const VIEW_TYPE_POOL_VIEW = 'pool_view';
    const VIEW_TYPE_GARDEN_VIEW = 'garden_view';
    const VIEW_TYPE_CITY_VIEW = 'city_view';

    const VIEW_TYPES = [
        self::VIEW_TYPE_SEA_FRONT,
        self::VIEW_TYPE_SEA_VIEW,
        self::VIEW_TYPE_MOUNTAIN_VIEW,
        self::VIEW_TYPE_POOL_VIEW,
        self::VIEW_TYPE_GARDEN_VIEW,
        self::VIEW_TYPE_CITY_VIEW,
    ];

    // ================================================================
    // Occupancy Types
    // ================================================================
    const OCCUPANCY_OWNER_OCCUPIED = 'owner_occupied';
    const OCCUPANCY_TENANT = 'tenant';
    const OCCUPANCY_VACANT = 'vacant';

    const OCCUPANCY_TYPES = [
        self::OCCUPANCY_OWNER_OCCUPIED,
        self::OCCUPANCY_TENANT,
        self::OCCUPANCY_VACANT,
    ];

    // ================================================================
    // Cities (TRNC)
    // ================================================================
    const CITY_NICOSIA = 'nicosia';
    const CITY_KYRENIA = 'kyrenia';
    const CITY_FAMAGUSTA = 'famagusta';
    const CITY_GUZELYURT = 'guzelyurt';
    const CITY_ISKELE = 'iskele';
    const CITY_LEFKE = 'lefke';

    const CITIES = [
        self::CITY_NICOSIA,
        self::CITY_KYRENIA,
        self::CITY_FAMAGUSTA,
        self::CITY_GUZELYURT,
        self::CITY_ISKELE,
        self::CITY_LEFKE,
    ];

    // ================================================================
    // Enhanced Title Deed Types (replacing old ones)
    // ================================================================
    const DEED_TYPE_TURKISH_BRITISH = 'turkish_british';
    const DEED_TYPE_EXCHANGE = 'exchange';
    const DEED_TYPE_TRNC_ALLOCATION = 'trnc_allocation';
    const DEED_TYPE_LEASEHOLD = 'leasehold';
    const DEED_TYPE_MUJAHIT = 'mujahit';

    const DEED_TYPES = [
        self::DEED_TYPE_TURKISH_BRITISH,
        self::DEED_TYPE_EXCHANGE,
        self::DEED_TYPE_TRNC_ALLOCATION,
        self::DEED_TYPE_LEASEHOLD,
        self::DEED_TYPE_MUJAHIT,
    ];

    // ================================================================
    // Deed Status
    // ================================================================
    const DEED_STATUS_OWNER_INDIVIDUAL = 'owner_individual';
    const DEED_STATUS_OWNER_SHARED = 'owner_shared';
    const DEED_STATUS_DEVELOPER_READY = 'developer_ready';
    const DEED_STATUS_NO_DEED = 'no_deed';

    const DEED_STATUSES = [
        self::DEED_STATUS_OWNER_INDIVIDUAL,
        self::DEED_STATUS_OWNER_SHARED,
        self::DEED_STATUS_DEVELOPER_READY,
        self::DEED_STATUS_NO_DEED,
    ];

    // ================================================================
    // Land Types
    // ================================================================
    const LAND_TYPE_RESIDENTIAL = 'residential_zoned';
    const LAND_TYPE_FIELD = 'field';
    const LAND_TYPE_RESIDENTIAL_COMMERCIAL = 'residential_commercial';
    const LAND_TYPE_COMMERCIAL = 'commercial_zoned';
    const LAND_TYPE_INDUSTRIAL = 'industrial_zoned';
    const LAND_TYPE_TOURISTIC = 'touristic';
    const LAND_TYPE_OLIVE_GROVE = 'olive_grove';

    const LAND_TYPES = [
        self::LAND_TYPE_RESIDENTIAL,
        self::LAND_TYPE_FIELD,
        self::LAND_TYPE_RESIDENTIAL_COMMERCIAL,
        self::LAND_TYPE_COMMERCIAL,
        self::LAND_TYPE_INDUSTRIAL,
        self::LAND_TYPE_TOURISTIC,
        self::LAND_TYPE_OLIVE_GROVE,
    ];

    // ================================================================
    // Outside Features
    // ================================================================
    const OUTSIDE_FEATURES = [
        'barbeque', 'bounding_wall', 'double_glazing', 'car_park_closed', 'garage',
        'garden', 'generator', 'lift', 'car_park_open', 'private_pool', 'public_pool',
        'sari_tas_ev', 'security_cam', 'water_well', 'terrace', 'thermal_insulation', 'water_tank',
    ];

    // ================================================================
    // Inside Features
    // ================================================================
    const INSIDE_FEATURES = [
        'air_condition', 'balcony', 'bath_tube', 'blind', 'built_in_kitchen', 'ceramic',
        'closet', 'entryphone', 'fire_alarm', 'fireplace', 'kartonpiyer', 'laundry',
        'master_room_bath', 'master_room_cabinet', 'natural_marble', 'panel_door', 'pantry',
        'parquet', 'shower', 'solar_electric', 'steel_door', 'tv_infrastructure',
        'coat_check', 'wallpaper', 'water_booster',
    ];

    // ================================================================
    // Status types (extended)
    // ================================================================
    const STATUS_RESERVED = 'Reserved';
    const STATUS_RENTED = 'Rented';

    protected $fillable = [
        'product_id',
        'developer_project_id',
        'project_location_id',
        'added_by',
        'responsible_agent_id',
        'property_type',
        'primary_category',
        'unit_style',
        'construction_status',
        'sale_type',
        'price',
        'minimal_rental_period',
        'rent_payment_interval',
        'title_deed_type',
        'title_deed_stage',
        'status',
        'is_published',
        'published_at',
        'city',
        'map',
        'area',
        'distances',
        'land_size',
        'living_area_sqm',
        'gross_sqm',
        'terrace_area_sqm',
        'living_room',
        'bedrooms',
        'bathrooms',
        'rooms',
        'floor_number',
        'floors_in_building',
        'balcony_count',
        'balcony_net_sqm',
        'building_age',
        'completion_date',
        'furniture_status',
        'heating_type',
        'address',
        'latitude',
        'longitude',
        'current_occupancy',
        'open_to_swap',
        'swap_notes',
        'view_types',
        'within_site',
        'block_name',
        'unit_number',
        'exterior_features',
        'interior_features',
        'location_features',
        'outside_features',
        'inside_features',
        'title',
        'description',
        'video_url',
        'tour_360_url',
        'photos',
        'add_ons',
        'owner_info',
        'legal_info',
        'financial_info',
        'documents_checklist',
        'allow_101evler',
        'allow_hangiev',
        'land_details',
        'total_area_sqm',
        'plot_size_sqm',
        'floor',
        'has_restrictions',
        'restriction_notes',
        'deed_status',
        'price_to_owner',
        'hibarr_price',
        'commission_agreement_signed',
        'general_notes',
    ];

    /**
     * Override the parent's hidden fields to show timestamps
     * The parent ApiModel hides created_at and updated_at by default
     *
     * @var array
     */
    protected $hidden = ["pivot"];

    /**
     * Distances JSON structure (stored in the `distances` column):
     * {
     *   "military_base": "string|null",  // text description
     *   "sea": number|null,              // decimal km
     *   "hospital": number|null,         // decimal km
     *   "market": number|null,           // decimal km
     *   "schools": number|null           // decimal km
     * }
     *
     * Tax info is stored inside `legal_info` JSON:
     * { "tax_info": { "vat_paid": bool, "vat_not_paid": bool, "trafo_fee_paid": bool, "stopaj_paid": bool } }
     *
     * Document uploads are stored inside `documents_checklist` JSON:
     * { "search_document_url": "url", "sales_agreement_url": "url", "title_deed_copy_url": "url",
     *   "owner_passport_copy_url": "url", "site_plan_layout_url": "url" }
     */
    protected $casts = [
        'price' => PriceCast::class,
        'land_size' => 'decimal:2',
        'living_area_sqm' => 'decimal:2',
        'terrace_area_sqm' => 'decimal:2',
        'minimal_rental_period' => 'integer',
        'building_age' => 'integer',
        'bathrooms' => 'integer',
        'rooms' => 'integer',
        'floor_number' => 'integer',
        'floors_in_building' => 'integer',
        'balcony_count' => 'integer',
        'gross_sqm' => 'decimal:2',
        'balcony_net_sqm' => 'decimal:2',
        'latitude' => 'decimal:8',
        'longitude' => 'decimal:8',
        'within_site' => 'boolean',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
        'completion_date' => 'date',
        'open_to_swap' => 'boolean',
        'allow_101evler' => 'boolean',
        'allow_hangiev' => 'boolean',
        'view_types' => 'array',
        'distances' => 'array',
        'exterior_features' => 'array',
        'interior_features' => 'array',
        'location_features' => 'array',
        'outside_features' => 'array',
        'inside_features' => 'array',
        'photos' => 'array',
        'add_ons' => 'array',
        'owner_info' => 'array',
        'legal_info' => 'array',
        'financial_info' => 'array',
        'documents_checklist' => 'array',
        'land_details' => 'array',
        'total_area_sqm' => 'decimal:2',
        'plot_size_sqm' => 'decimal:2',
        'has_restrictions' => 'boolean',
        'price_to_owner' => 'decimal:2',
        'hibarr_price' => 'decimal:2',
        'commission_agreement_signed' => 'boolean',
    ];

    private const SLUG_SAVE_MAX_ATTEMPTS = 5;

    public function getPriceAttribute($value)
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            $decoded = json_decode($value, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded) && array_key_exists('amount', $decoded)) {
                return (float) $decoded['amount'];
            }
        }

        return is_numeric($value) ? (float) $value : $value;
    }

    public function setPriceAttribute($value): void
    {
        if ($value === null) {
            $this->attributes['price'] = null;
            return;
        }

        if (is_numeric($value)) {
            $this->attributes['price'] = json_encode([
                'amount' => (float) $value,
                'currency' => company()?->currency?->currency_code ?? 'TRY',
            ]);
            return;
        }

        $this->attributes['price'] = $value;
    }
    /**
     * Boot: generate unique slug from title on create/update when title is present.
     */
    protected static function booted(): void
    {
        static::saving(function (Property $model) {
            if (empty($model->title)) {
                return;
            }
            $titleChanged = $model->isDirty('title');
            $slugEmpty = empty($model->slug);
            if ($slugEmpty || $titleChanged) {
                $model->slug = self::makeUniqueSlug(
                    $model->title,
                    $model->company_id ?? 0,
                    $model->id
                );
            }
        });
    }

    /**
     * Save the model. On unique constraint failure (slug), regenerate slug and retry up to SLUG_SAVE_MAX_ATTEMPTS.
     *
     * @param array<string, mixed> $options
     * @return bool
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
                    $this->title ?: 'property',
                    $this->company_id ?? 0,
                    $this->id
                );
            }
        }
    }

    /**
     * Generate a unique slug from title. If slug exists, append short random id (e.g. luxury-3-bedroom-condo-8xf2).
     */
    public static function makeUniqueSlug(string $title, ?int $companyId = null, $excludeId = null): string
    {
        $base = Str::slug($title);
        if ($base === '') {
            $base = 'property';
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
     * Attributes to append to the model's array/JSON form.
     */
    protected $appends = [
        'reference_code',
        'effective_location',
        'has_project_location',
        'display_title',
    ];

    // Relationships
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Get the developer project this property belongs to.
     * 
     * A property can only belong to one project at a time.
     * Properties inherit location context from their project.
     */
    public function developerProject(): BelongsTo
    {
        return $this->belongsTo(DeveloperProject::class);
    }

    /**
     * Get the direct project location for this property.
     * 
     * This takes priority over the developer project's location.
     */
    public function projectLocation(): BelongsTo
    {
        return $this->belongsTo(ProjectLocation::class);
    }

    /**
     * Get the user who created/added this property.
     */
    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    /**
     * Get the responsible agent for this property.
     * Defaults to the creator if not explicitly set.
     */
    public function responsibleAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_agent_id');
    }

    /**
     * Get availability requests for this property.
     */
    public function availabilityRequests(): HasMany
    {
        return $this->hasMany(PropertyAvailabilityRequest::class);
    }

    /**
     * Check if property is assigned to a project.
     */
    public function isAssignedToProject(): bool
    {
        return $this->developer_project_id !== null;
    }

    /**
     * Check if property is published.
     */
    public function isPublished(): bool
    {
        return (bool) $this->is_published;
    }

    /**
     * Check if the given user is the creator of this property.
     */
    public function isCreator(?int $userId): bool
    {
        if ($userId === null) {
            return false;
        }
        return $this->added_by === $userId;
    }

    /**
     * Check if the given user is the responsible agent.
     */
    public function isResponsibleAgent(?int $userId): bool
    {
        if ($userId === null) {
            return false;
        }
        return $this->responsible_agent_id === $userId;
    }

    /**
     * Check if the given user can edit this property.
     * Only creator, responsible agent, or admin can edit.
     */
    public function canBeEditedBy(?int $userId, bool $isAdmin = false): bool
    {
        if ($isAdmin) {
            return true;
        }
        return $this->isCreator($userId) || $this->isResponsibleAgent($userId);
    }

    /**
     * Publish the property.
     */
    public function publish(): bool
    {
        $this->is_published = true;
        $this->published_at = now();
        return $this->save();
    }

    /**
     * Unpublish the property (set to draft).
     */
    public function unpublish(): bool
    {
        $this->is_published = false;
        $this->published_at = null;
        return $this->save();
    }

    /**
     * Return the first argument that is non-empty after trim, or null.
     *
     * @param mixed ...$values
     * @return string|null
     */
    private function pickFirstNonEmpty(mixed ...$values): ?string
    {
        foreach ($values as $v) {
            if ($v !== null && trim((string) $v) !== '') {
                return trim((string) $v);
            }
        }
        return null;
    }

    // ================================================================
    // Computed Attributes (Accessors)
    // ================================================================

    /**
     * Generate the reference code dynamically.
     * 
     * Format: [TYPE]-[SUBTYPE]-[ROOMS]-[ID]
     * Examples:
     * - A 1+1 Loft Apartment: APT-LFT-11-402
     * - A 5-Bedroom Villa (5+1): VIL-STD-51-882
     * - A Studio Garden Apartment: APT-GRD-S-105
     * - A 3+1 Penthouse: APT-PEN-31-007
     *
     * @return string
     */
    public function getReferenceCodeAttribute(): string
    {
        // Get type code
        $typeCode = self::TYPE_CODES[$this->property_type] ?? 'OTH';
        
        // Get subtype code
        $subtypeCode = self::SUBTYPE_CODES[$this->unit_style ?? self::UNIT_STYLE_STANDARD] ?? 'STD';
        
        // Get room code: bedrooms + living room (1), or 'S' for studio
        if ($this->unit_style === self::UNIT_STYLE_STUDIO) {
            $roomCode = 'S';
        } else {
            $bedrooms = (int) ($this->bedrooms ?? 0);
            $livingRoom = (int) ($this->living_room ?? 1);
            $roomCode = $bedrooms . $livingRoom;
        }
        
        // Use property ID (padded if less than 3 digits)
        $idCode = $this->id ? str_pad((string) $this->id, 3, '0', STR_PAD_LEFT) : '000';
        
        return sprintf('%s-%s-%s-%s', $typeCode, $subtypeCode, $roomCode, $idCode);
    }

    /**
     * Get the display title for this property.
     * 
     * If title is set, use it. Otherwise, use the reference code.
     *
     * @return string
     */
    public function getDisplayTitleAttribute(): string
    {
        if (!empty($this->title)) {
            return $this->title;
        }
        
        return $this->reference_code;
    }

    /**
     * Get the effective location for this property.
     *
     * Priority:
     * 1. Direct project_location_id (if set)
     * 2. Developer project's location (if property is assigned to a project)
     * 3. Property's own city/area fields
     *
     * @return array{city: string|null, area: string|null}
     */
    public function getEffectiveLocationAttribute(): array
    {
        // Priority 1: Direct project location
        $directLocation = $this->projectLocation;
        if ($directLocation) {
            $city = $this->pickFirstNonEmpty(
                $directLocation->name,
                $directLocation->city ?? null,
                $this->city
            );
            $address = $directLocation->address ?? [];
            $area = $this->pickFirstNonEmpty(
                isset($address['country']) ? $address['country'] : null,
                $this->area
            );
            return [
                'city' => $city,
                'area' => $area,
            ];
        }

        // Priority 2: Developer project's location
        $projectLocation = $this->developerProject?->location;
        if ($projectLocation) {
            $city = $this->pickFirstNonEmpty(
                $projectLocation->name,
                $projectLocation->city ?? null,
                $this->city
            );
            $address = $projectLocation->address ?? [];
            $area = $this->pickFirstNonEmpty(
                isset($address['country']) ? $address['country'] : null,
                $this->area
            );
            return [
                'city' => $city,
                'area' => $area,
            ];
        }

        // Priority 3: Property's own fields
        return [
            'city' => $this->pickFirstNonEmpty($this->city),
            'area' => $this->pickFirstNonEmpty($this->area),
        ];
    }

    /**
     * Check if property has a location (direct or via project).
     *
     * @return bool
     */
    public function getHasProjectLocationAttribute(): bool
    {
        return $this->project_location_id !== null 
            || $this->developerProject?->location !== null;
    }

    public function assets(): HasMany
    {
        return $this->hasMany(PropertyAsset::class)->orderBy('order')->orderBy('created_at', 'desc');
    }

    public function images(): HasMany
    {
        return $this->hasMany(PropertyAsset::class)->where('asset_type', PropertyAsset::TYPE_IMAGE);
    }

    public function videos(): HasMany
    {
        return $this->hasMany(PropertyAsset::class)->whereIn('asset_type', [PropertyAsset::TYPE_VIDEO, PropertyAsset::TYPE_VIDEO_URL]);
    }

    // Scopes
    public function scopeAvailable($query)
    {
        return $query->where('status', self::STATUS_AVAILABLE);
    }

    public function scopeByCategory($query, $category)
    {
        return $query->where('property_type', $category);
    }

    public function scopeBySaleType($query, $saleType)
    {
        return $query->where('sale_type', $saleType);
    }

    // Helper methods
    public function isAvailable(): bool
    {
        return $this->status === self::STATUS_AVAILABLE;
    }

    public function isSold(): bool
    {
        return $this->status === self::STATUS_SOLD;
    }

    public function isUnderOffer(): bool
    {
        return $this->status === self::STATUS_UNDER_OFFER;
    }

    public function isWithdrawn(): bool
    {
        return $this->status === self::STATUS_WITHDRAWN;
    }

    public function isForSale(): bool
    {
        return $this->sale_type === self::SALE_TYPE_FOR_SALE;
    }

    public function isForRent(): bool
    {
        return $this->sale_type === self::SALE_TYPE_FOR_RENT;
    }

    public function isDailyRental(): bool
    {
        return $this->sale_type === self::SALE_TYPE_DAILY_RENTAL;
    }

    /**
     * Generate a suggested title based on property details.
     * 
     * Pattern: {Site Name} | {Beds}BR {Type} | {Sale Type} | {Location Name}
     * Example: "Nest Projects | 4BR Apartment | SALE | Girne"
     * 
     * Falls back to simpler patterns if data is incomplete.
     *
     * @return string
     */
    public function generateSuggestedTitle(): string
    {
        $parts = [];

        // Site/Project Name
        $siteName = $this->developerProject?->name;
        if ($siteName) {
            $parts[] = $siteName;
        }

        // Bedrooms + Property Type
        $typeDescription = '';
        if ($this->bedrooms && is_numeric($this->bedrooms)) {
            $typeDescription = $this->bedrooms . 'BR ';
        }
        if ($this->property_type) {
            $typeDescription .= $this->property_type;
        }
        if (trim($typeDescription)) {
            $parts[] = trim($typeDescription);
        }

        // Sale Type (shortened)
        if ($this->sale_type) {
            $saleTypeShort = match ($this->sale_type) {
                self::SALE_TYPE_FOR_SALE => 'SALE',
                self::SALE_TYPE_FOR_RENT => 'RENT',
                self::SALE_TYPE_DAILY_RENTAL => 'DAILY RENTAL',
                default => strtoupper($this->sale_type),
            };
            $parts[] = $saleTypeShort;
        }

        // Location Name (prefer project location, fall back to city)
        $locationName = $this->effective_location['city'] ?? $this->city;
        if ($locationName) {
            $parts[] = $locationName;
        }

        // Join with separator
        $title = implode(' | ', array_filter($parts));

        // Fallback if we have very little info
        if (empty($title)) {
            $title = 'Property';
            if ($this->block_name) {
                $title .= ' - ' . $this->block_name;
            }
            if ($this->unit_number) {
                $title .= ' Unit ' . $this->unit_number;
            }
        }

        return $title;
    }

    /**
     * Generate a suggested title from array data (static version for use before model creation).
     * 
     * @param array $data Property data array
     * @param string|null $projectName Developer project name (if known)
     * @param string|null $locationName Location name (if known)
     * @return string
     */
    public static function generateSuggestedTitleFromData(array $data, ?string $projectName = null, ?string $locationName = null): string
    {
        $parts = [];

        // Site/Project Name
        if ($projectName) {
            $parts[] = $projectName;
        }

        // Bedrooms + Property Type
        $typeDescription = '';
        $bedrooms = $data['bedrooms'] ?? null;
        if ($bedrooms && is_numeric($bedrooms)) {
            $typeDescription = $bedrooms . 'BR ';
        }
        $propertyType = $data['property_type'] ?? null;
        if ($propertyType) {
            $typeDescription .= $propertyType;
        }
        if (trim($typeDescription)) {
            $parts[] = trim($typeDescription);
        }

        // Sale Type (shortened)
        $saleType = $data['sale_type'] ?? null;
        if ($saleType) {
            $saleTypeShort = match ($saleType) {
                self::SALE_TYPE_FOR_SALE => 'SALE',
                self::SALE_TYPE_FOR_RENT => 'RENT',
                self::SALE_TYPE_DAILY_RENTAL => 'DAILY RENTAL',
                default => strtoupper($saleType),
            };
            $parts[] = $saleTypeShort;
        }

        // Location Name
        $location = $locationName ?? $data['city'] ?? null;
        if ($location) {
            $parts[] = $location;
        }

        // Join with separator
        $title = implode(' | ', array_filter($parts));

        // Fallback
        if (empty($title)) {
            $title = 'Property';
            $blockName = $data['block_name'] ?? null;
            $unitNumber = $data['unit_number'] ?? null;
            if ($blockName) {
                $title .= ' - ' . $blockName;
            }
            if ($unitNumber) {
                $title .= ' Unit ' . $unitNumber;
            }
        }

        return $title;
    }

    // Get allowed property types based on category and sale type
    public static function getAllowedPropertyTypes(string $category, string $saleType): array
    {
        $configurations = self::getPropertyConfigurations();
        
        if (!isset($configurations[$category]) || !isset($configurations[$category][$saleType])) {
            return [];
        }
        
        return $configurations[$category][$saleType];
    }

    // Get allowed fields based on category
    public static function getAllowedFields(string $category): array
    {
        $configurations = self::getPropertyConfigurations();
        
        if (!isset($configurations[$category]['allowableFields'])) {
            return [];
        }
        
        return array_keys(array_filter($configurations[$category]['allowableFields']));
    }

    // Property configurations based on TypeScript design
    public static function getPropertyConfigurations(): array
    {
        return [
            self::CATEGORY_HOUSING => [
                self::SALE_TYPE_FOR_SALE => [
                    self::PROPERTY_TYPE_VILLA, self::PROPERTY_TYPE_TWIN_VILLA, self::PROPERTY_TYPE_APARTMENT,
                    self::PROPERTY_TYPE_FAMILY_HOME, self::PROPERTY_TYPE_TOWNHOUSE, self::PROPERTY_TYPE_LOFT,
                    self::PROPERTY_TYPE_PENTHOUSE, self::PROPERTY_TYPE_BUNGALOW, self::PROPERTY_TYPE_COMMERCIAL_PROPERTY,
                    self::PROPERTY_TYPE_BLOCK_APARTMENTS, self::PROPERTY_TYPE_COMPLETE_BUILDING, 
                    self::PROPERTY_TYPE_ABANDONED_BUILDING, self::PROPERTY_TYPE_RESIDENCE, self::PROPERTY_TYPE_HALF_CONSTRUCTION
                ],
                self::SALE_TYPE_FOR_RENT => [
                    self::PROPERTY_TYPE_VILLA, self::PROPERTY_TYPE_APARTMENT, self::PROPERTY_TYPE_TWIN_VILLA,
                    self::PROPERTY_TYPE_FAMILY_HOME, self::PROPERTY_TYPE_PENTHOUSE, self::PROPERTY_TYPE_BUNGALOW,
                    self::PROPERTY_TYPE_TIME_SHARE, self::PROPERTY_TYPE_COMPLETE_BUILDING, 
                    self::PROPERTY_TYPE_ABANDONED_BUILDING, self::PROPERTY_TYPE_RESIDENCE, self::PROPERTY_TYPE_HALF_CONSTRUCTION
                ],
                self::SALE_TYPE_DAILY_RENTAL => [
                    self::PROPERTY_TYPE_VILLA, self::PROPERTY_TYPE_APARTMENT, self::PROPERTY_TYPE_TWIN_VILLA,
                    self::PROPERTY_TYPE_FAMILY_HOME, self::PROPERTY_TYPE_PENTHOUSE, self::PROPERTY_TYPE_BUNGALOW,
                    self::PROPERTY_TYPE_TIME_SHARE, self::PROPERTY_TYPE_COMPLETE_BUILDING, 
                    self::PROPERTY_TYPE_ABANDONED_BUILDING, self::PROPERTY_TYPE_RESIDENCE, self::PROPERTY_TYPE_HALF_CONSTRUCTION
                ],
                'allowableFields' => [
                    'propertyType' => true, 'price' => true, 'minRentalPeriod' => true,
                    'rentPaymentInterval' => true, 'typeTitleDeed' => true, 'titleDeedStage' => true,
                    'status' => true, 'city' => true, 'map' => true, 'area' => true,
                    'landSize' => false, 'livingRoom' => true, 'bedRoom' => true, 'bathRoom' => true,
                    'floorNumber' => true, 'floorsInBuilding' => true, 'isThisResidenceWithinASite' => true,
                    'exteriorFeatures' => true, 'interiorFeatures' => true, 'loacationFeatures' => true,
                    'title' => true, 'description' => true, 'videoUrl' => true, '360TourUrl' => true,
                    'photos' => true, 'addOns' => true
                ]
            ],
            self::CATEGORY_LAND => [
                self::SALE_TYPE_FOR_SALE => [
                    self::PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND, self::PROPERTY_TYPE_FIELD, 
                    self::PROPERTY_TYPE_RESIDENTIAL_COMMERCIAL_LAND, self::PROPERTY_TYPE_COMMERCIALLY_ZONED_LAND,
                    self::PROPERTY_TYPE_INDUSTRIALLY_ZONED_LAND, self::PROPERTY_TYPE_TOURISM_ZONED_LAND,
                    self::PROPERTY_TYPE_OLIVE_GROVE
                ],
                self::SALE_TYPE_FOR_RENT => [
                    self::PROPERTY_TYPE_RESIDENTIALLY_ZONED_LAND, self::PROPERTY_TYPE_FIELD, 
                    self::PROPERTY_TYPE_RESIDENTIAL_COMMERCIAL_LAND, self::PROPERTY_TYPE_COMMERCIALLY_ZONED_LAND,
                    self::PROPERTY_TYPE_INDUSTRIALLY_ZONED_LAND, self::PROPERTY_TYPE_TOURISM_ZONED_LAND,
                    self::PROPERTY_TYPE_OLIVE_GROVE
                ],
                self::SALE_TYPE_DAILY_RENTAL => [],
                'allowableFields' => [
                    'propertyType' => true, 'price' => true, 'minRentalPeriod' => false,
                    'rentPaymentInterval' => false, 'typeTitleDeed' => true, 'titleDeedStage' => true,
                    'status' => true, 'city' => true, 'map' => true, 'area' => true,
                    'landSize' => true, 'livingRoom' => false, 'bedRoom' => false, 'bathRoom' => false,
                    'floorNumber' => false, 'floorsInBuilding' => false, 'isThisResidenceWithinASite' => false,
                    'exteriorFeatures' => false, 'interiorFeatures' => false, 'loacationFeatures' => true,
                    'title' => true, 'description' => true, 'videoUrl' => true, '360TourUrl' => true,
                    'photos' => true, 'addOns' => false
                ]
            ],
            self::CATEGORY_COMMERCIAL => [
                self::SALE_TYPE_FOR_SALE => [
                    self::PROPERTY_TYPE_SHOP, self::PROPERTY_TYPE_HOTEL, self::PROPERTY_TYPE_WORKPLACE,
                    self::PROPERTY_TYPE_WAREHOUSE, self::PROPERTY_TYPE_WORKPLACE_FOR_SALE, self::PROPERTY_TYPE_OFFICE
                ],
                self::SALE_TYPE_FOR_RENT => [
                    self::PROPERTY_TYPE_SHOP, self::PROPERTY_TYPE_HOTEL, self::PROPERTY_TYPE_WORKPLACE,
                    self::PROPERTY_TYPE_WAREHOUSE, self::PROPERTY_TYPE_WORKPLACE_FOR_SALE, self::PROPERTY_TYPE_OFFICE
                ],
                self::SALE_TYPE_DAILY_RENTAL => [
                    self::PROPERTY_TYPE_SHOP, self::PROPERTY_TYPE_HOTEL, self::PROPERTY_TYPE_WORKPLACE,
                    self::PROPERTY_TYPE_WAREHOUSE, self::PROPERTY_TYPE_WORKPLACE_FOR_SALE, self::PROPERTY_TYPE_OFFICE
                ],
                'allowableFields' => [
                    'propertyType' => true, 'price' => true, 'minRentalPeriod' => true,
                    'rentPaymentInterval' => true, 'typeTitleDeed' => true, 'titleDeedStage' => true,
                    'status' => true, 'city' => true, 'map' => true, 'area' => true,
                    'landSize' => true, 'livingRoom' => false, 'bedRoom' => false, 'bathRoom' => true,
                    'floorNumber' => true, 'floorsInBuilding' => true, 'isThisResidenceWithinASite' => false,
                    'exteriorFeatures' => true, 'interiorFeatures' => true, 'loacationFeatures' => true,
                    'title' => true, 'description' => true, 'videoUrl' => true, '360TourUrl' => true,
                    'photos' => true, 'addOns' => true
                ]
            ]
        ];
    }

    /**
     * All property types as a flat, unique, sorted list (derived from getPropertyConfigurations).
     */
    public static function getAllPropertyTypes(): array
    {
        $config = self::getPropertyConfigurations();
        $types = [];
        foreach ($config as $category => $categoryData) {
            if (!is_array($categoryData)) {
                continue;
            }
            foreach ($categoryData as $key => $value) {
                if ($key === 'allowableFields' || !is_array($value)) {
                    continue;
                }
                foreach ($value as $type) {
                    if (is_string($type)) {
                        $types[$type] = true;
                    }
                }
            }
        }
        $list = array_keys($types);
        sort($list);
        return array_values($list);
    }

    /**
     * All feature options (exterior, interior, location) as one flat, unique, sorted list.
     */
    public static function getAllFeatures(): array
    {
        $exterior = [
            'Balcony', 'Garden', 'Swimming Pool', 'Terrace', 'Garage', 'Parking', 'Fenced Yard', 'Outdoor Kitchen',
            'Fire Pit', 'Deck', 'Patio', 'Lawn', 'Irrigation System', 'Playground', 'Tennis Court', 'Basketball Court',
            'Sauna', 'Hot Tub', 'Outdoor Lighting', 'Storage Shed', 'Greenhouse',
        ];
        $interior = [
            'Fireplace', 'Hardwood Floors', 'Granite Countertops', 'Walk-in Closet', 'Central Air Conditioning',
            'Stainless Steel Appliances', 'Vaulted Ceilings', 'Recessed Lighting', 'Crown Molding', 'Built-in Shelving',
            'Smart Home Features', 'Laundry Room', 'Breakfast Nook', 'Home Office', 'Wet Bar', 'Skylights',
            'Tile Flooring', 'Carpeted Floors', 'Open Floor Plan', 'Security System',
        ];
        $location = [
            'Near Public Transport', 'Close to Schools', 'Shopping Nearby', 'Parks and Recreation', 'Waterfront',
            'Mountain Views', 'Downtown Access', 'Quiet Neighborhood', 'Gated Community', 'Golf Course Nearby',
            'Hiking Trails', 'Bike Paths', 'Cultural Attractions', 'Restaurants and Cafes', 'Medical Facilities',
            'Entertainment Venues', 'Airport Proximity', 'Public Services', 'Community Events',
        ];
        $flat = array_merge($exterior, $interior, $location);
        $flat = array_values(array_unique($flat));
        sort($flat);
        return $flat;
    }

    // Validation helper to check if updates are allowed based on current status
    public function canUpdateField(string $field): bool
    {
        // If property is sold, only allow certain fields to be updated
        if ($this->isSold()) {
            $allowedWhenSold = ['description', 'video_url', 'tour_360_url', 'general_notes'];
            return in_array($field, $allowedWhenSold);
        }

        // If property is under offer, restrict price and sale type changes
        if ($this->isUnderOffer()) {
            $restrictedWhenUnderOffer = ['price', 'sale_type'];
            return !in_array($field, $restrictedWhenUnderOffer);
        }

        return true;
    }

    public function tasks()
    {
        return $this->morphToMany(Task::class, 'taskable');
    }

    // ================================================================
    // Static Methods for Enum Values (Frontend API)
    // ================================================================

    /**
     * Get all enum values for the frontend.
     * This provides a single source of truth for all dropdown options.
     *
     * Values are sourced from lookup tables when available, falling
     * back to the legacy constants for backward compatibility.
     */
    public static function getEnumValues(): array
    {
        return [
            'primary_categories' => self::getLookupNames(PropertyPrimaryCategory::class, self::PRIMARY_CATEGORIES),
            'unit_styles' => self::getLookupNames(PropertySubType::class, self::UNIT_STYLES),
            'construction_statuses' => self::CONSTRUCTION_STATUSES,
            'view_types' => self::getLookupNames(PropertyViewType::class, self::VIEW_TYPES),
            'occupancy_types' => self::OCCUPANCY_TYPES,
            'cities' => self::CITIES,
            'deed_types' => self::getLookupNames(PropertyTitleDeedType::class, self::DEED_TYPES),
            'deed_statuses' => self::getLookupNames(PropertyDeedStatus::class, self::DEED_STATUSES),
            'land_types' => self::LAND_TYPES,
            'outside_features' => self::getLookupNames(PropertyExteriorFeature::class, self::OUTSIDE_FEATURES),
            'inside_features' => self::getLookupNames(PropertyInteriorFeature::class, self::INSIDE_FEATURES),
            'property_types' => self::getLookupValues(PropertyType::class, self::getAllPropertyTypes()),
            'floor_types' => self::getLookupValues(PropertyFloorType::class, []),
            'furniture_statuses' => [
                self::FURNITURE_UNFURNISHED,
                self::FURNITURE_FULLY_FURNISHED,
                self::FURNITURE_PART_FURNISHED,
                self::FURNITURE_WHITE_GOODS_ONLY,
            ],
            'sale_types' => [
                self::SALE_TYPE_FOR_SALE,
                self::SALE_TYPE_FOR_RENT,
                self::SALE_TYPE_DAILY_RENTAL,
            ],
            'statuses' => [
                self::STATUS_AVAILABLE,
                self::STATUS_RESERVED,
                self::STATUS_UNDER_OFFER,
                self::STATUS_SOLD,
                self::STATUS_RENTED,
                self::STATUS_WITHDRAWN,
            ],
            'type_codes' => self::TYPE_CODES,
            'subtype_codes' => self::SUBTYPE_CODES,
        ];
    }

    /**
     * Get lookup names from a lookup table model, falling back to constants.
     *
     * @param class-string $modelClass  The lookup model class
     * @param array        $fallback    Fallback constant values
     * @return array<string>            List of name values
     */
    private static function getLookupNames(string $modelClass, array $fallback): array
    {
        try {
            $values = $modelClass::pluck('name')->toArray();
            return !empty($values) ? $values : $fallback;
        } catch (\Throwable) {
            return $fallback;
        }
    }

    /**
     * Get lookup values (name + label pairs) from a lookup table model.
     * Returns [{name, label}] for richer dropdown rendering on the frontend.
     *
     * @param class-string $modelClass  The lookup model class
     * @param array        $fallback    Fallback constant values (plain names)
     * @return array
     */
    private static function getLookupValues(string $modelClass, array $fallback): array
    {
        try {
            $values = $modelClass::select('name', 'label')->get()->toArray();
            if (!empty($values)) {
                return $values;
            }
        } catch (\Throwable) {
            // fall through
        }

        // Return fallback as [{name, label}] format
        return array_map(fn($name) => ['name' => $name, 'label' => $name], $fallback);
    }

    /**
     * Scope to filter only published properties.
     */
    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    /**
     * Scope to filter drafts (unpublished) properties.
     */
    public function scopeDrafts($query)
    {
        return $query->where('is_published', false);
    }

    /**
     * Scope to filter properties visible to a specific user.
     * - Published properties are visible to all
     * - Drafts are only visible to creator/responsible agent
     */
    public function scopeVisibleTo($query, ?int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('is_published', true);
            if ($userId) {
                $q->orWhere('added_by', $userId)
                  ->orWhere('responsible_agent_id', $userId);
            }
        });
    }

    /**
     * Scope to filter properties by primary category.
     */
    public function scopeByPrimaryCategory($query, string $category)
    {
        return $query->where('primary_category', $category);
    }

    /**
     * Scope to filter properties by unit style.
     */
    public function scopeByUnitStyle($query, string $style)
    {
        return $query->where('unit_style', $style);
    }

    /**
     * Scope to filter properties by construction status.
     */
    public function scopeByConstructionStatus($query, string $status)
    {
        return $query->where('construction_status', $status);
    }

    /**
     * Scope to filter properties by city.
     */
    public function scopeByCity($query, string $city)
    {
        return $query->where('city', $city);
    }

    /**
     * Scope to filter properties by responsible agent.
     */
    public function scopeByResponsibleAgent($query, int $agentId)
    {
        return $query->where('responsible_agent_id', $agentId);
    }

    /**
     * Scope to filter properties created by a specific user.
     */
    public function scopeCreatedBy($query, int $userId)
    {
        return $query->where('added_by', $userId);
    }
}
