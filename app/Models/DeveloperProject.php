<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

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
    use HasFactory, HasCompany, SoftDeletes;

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
    // Facility Constants
    // ================================================================
    const FACILITIES = [
        'gym', 'hamam', 'sauna', 'massage_spa', 'indoor_pool',
        'outdoor_pool', 'heated_indoor_pool', 'kids_playground',
        'aquapark', 'mini_zoo', 'clinics', 'restaurant',
        'beauty_center', 'walking_paths', 'cycling_routes',
        'hiking_routes', 'dentist', 'healing_yoga', 'tennis_court',
        'basketball_court', 'reception', 'security_24_7', 'beach',
        'beach_cinema', 'cinema', 'casino', 'jacuzzi',
        'gated_community', 'football_court', 'volleyball_court',
        'supermarket', 'cafe', 'bar', 'car_park',
        'cleaning_service', 'central_generator', 'on_site_management',
    ];

    const FACILITY_LABELS = [
        'gym' => 'Gym',
        'hamam' => 'Hamam',
        'sauna' => 'Sauna',
        'massage_spa' => 'Massage and Spa',
        'indoor_pool' => 'Indoor Pool',
        'outdoor_pool' => 'Outdoor Pool',
        'heated_indoor_pool' => 'Heated Indoor Pool',
        'kids_playground' => 'Kids Playground',
        'aquapark' => 'Aquapark',
        'mini_zoo' => 'Mini Zoo',
        'clinics' => 'Clinics',
        'restaurant' => 'Restaurant',
        'beauty_center' => 'Beauty Center',
        'walking_paths' => 'Walking Paths',
        'cycling_routes' => 'Cycling Routes',
        'hiking_routes' => 'Hiking Routes',
        'dentist' => 'Dentist',
        'healing_yoga' => 'Healing/Yoga',
        'tennis_court' => 'Tennis Court',
        'basketball_court' => 'Basketball Court',
        'reception' => 'Reception',
        'security_24_7' => '24/7 Security',
        'beach' => 'Beach',
        'beach_cinema' => 'Beach Cinema',
        'cinema' => 'Cinema',
        'casino' => 'Casino',
        'jacuzzi' => 'Jacuzzi',
        'gated_community' => 'Gated Community',
        'football_court' => 'Football Court',
        'volleyball_court' => 'Volleyball Court',
        'supermarket' => 'Supermarket',
        'cafe' => 'Cafe',
        'bar' => 'Bar',
        'car_park' => 'Car Park',
        'cleaning_service' => 'Cleaning Service',
        'central_generator' => 'Central Generator',
        'on_site_management' => 'On-site Management',
    ];

    protected $fillable = [
        'company_id',
        'developer_id',
        'name',
        'reference_code',
        'description',
        'project_location_id',
        // Construction project fields
        'google_drive_link',
        'availability_link',
        'starting_price',
        'primary_categories',
        'title_deed_type',
        'unit_types',
        'number_of_units',
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
    ];

    /**
     * Eager load these relations by default
     */
    protected $with = [];

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

        // Count existing projects for this developer within the company
        $existingCount = static::where('company_id', $this->company_id)
            ->where('developer_id', $this->developer_id)
            ->where('id', '!=', $this->id ?? 0)
            ->whereNotNull('reference_code')
            ->count();

        $number = str_pad($existingCount + 1, 3, '0', STR_PAD_LEFT);

        return $prefix . '-' . $number;
    }
}
