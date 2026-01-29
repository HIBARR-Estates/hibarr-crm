<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

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

    // Title Deed Stages
    const TITLE_DEED_STAGE_LAND = 'Land Title Deed';
    const TITLE_DEED_STAGE_SHARED = 'Shared Holder Title Deed';
    const TITLE_DEED_STAGE_INDIVIDUAL = 'Individual Title Deed';
    const TITLE_DEED_STAGE_KAT_IRTIRFAKLI = 'Individiual (Kat Irtirfakli) Title Deed';

    // Furniture Status
    const FURNITURE_UNFURNISHED = 'Unfurnished';
    const FURNITURE_FULLY_FURNISHED = 'Fully Furnished';
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

    protected $fillable = [
        'product_id',
        'developer_project_id',
        'property_type',
        'sale_type',
        'price',
        'minimal_rental_period',
        'rent_payment_interval',
        'title_deed_type',
        'title_deed_stage',
        'status',
        'city',
        'map',
        'area',
        'land_size',
        'living_room',
        'bedrooms',
        'bathrooms',
        'floor_number',
        'floors_in_building',
        'building_age',
        'furniture_status',
        'within_site',
        'exterior_features',
        'interior_features',
        'location_features',
        'title',
        'slug',
        'description',
        'video_url',
        'tour_360_url',
        'photos',
        'add_ons',
    ];

    /**
     * Override the parent's hidden fields to show timestamps
     * The parent ApiModel hides created_at and updated_at by default
     *
     * @var array
     */
    protected $hidden = ["pivot"];

    protected $casts = [
        'price' => \App\Casts\PriceCast::class,
        'land_size' => 'decimal:2',
        'minimal_rental_period' => 'integer',
        'building_age' => 'integer',
        'bathrooms' => 'integer',
        'floor_number' => 'integer',
        'floors_in_building' => 'integer',
        'within_site' => 'boolean',
        'exterior_features' => 'array',
        'interior_features' => 'array',
        'location_features' => 'array',
        'photos' => 'array',
        'add_ons' => 'array',
    ];

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
        'effective_location',
        'has_project_location',
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
     * Check if property is assigned to a project.
     */
    public function isAssignedToProject(): bool
    {
        return $this->developer_project_id !== null;
    }

    /**
     * Get the effective location for this property.
     * 
     * If the property is assigned to a DeveloperProject with a location,
     * derive city from location name and area from location address country.
     * Otherwise, fall back to the property's own city/area fields.
     *
     * @return array{city: string|null, area: string|null}
     */
    public function getEffectiveLocationAttribute(): array
    {
        $projectLocation = $this->developerProject?->location;
        
        if ($projectLocation) {
            return [
                'city' => $projectLocation->name ?? $projectLocation->city,
                'area' => $projectLocation->address['country'] ?? $this->area,
            ];
        }
        
        return [
            'city' => $this->city,
            'area' => $this->area,
        ];
    }

    /**
     * Check if property has a location derived from its developer project.
     *
     * @return bool
     */
    public function getHasProjectLocationAttribute(): bool
    {
        return (bool) $this->developerProject?->location;
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

    // Validation helper to check if updates are allowed based on current status
    public function canUpdateField(string $field): bool
    {
        // If property is sold, only allow certain fields to be updated
        if ($this->isSold()) {
            $allowedWhenSold = ['description', 'video_url', 'tour_360_url'];
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
}
