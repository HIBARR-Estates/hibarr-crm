<?php

namespace App\Models;

use App\Traits\HasCompany;
use App\Traits\HasOffers;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * DeveloperProjectUnitType Model
 * 
 * Represents a specific unit type within a developer/construction project.
 * Each project can have multiple unit types (e.g., 2+1 Apartment, Studio Villa)
 * with their own specifications, features, pricing, photos, and legal info.
 * 
 * Reference codes follow the pattern: DEVELOPER-NNN-UTxx
 * (e.g., AKACAN-001-UT01)
 */
class DeveloperProjectUnitType extends BaseModel
{
    use HasFactory, HasCompany, HasOffers, SoftDeletes;

    protected $table = 'developer_project_unit_types';

    // ================================================================
    // Primary Category Constants
    // ================================================================
    const CATEGORY_RESIDENTIAL = 'residential';
    const CATEGORY_COMMERCIAL = 'commercial';

    const PRIMARY_CATEGORIES = [
        self::CATEGORY_RESIDENTIAL => 'Residential',
        self::CATEGORY_COMMERCIAL => 'Commercial',
    ];

    // ================================================================
    // Property Type Constants (by category)
    // ================================================================
    const RESIDENTIAL_PROPERTY_TYPES = [
        'apartment' => 'Apartment',
        'villa' => 'Villa',
        'semi_detached_villa' => 'Semi-Detached Villa',
        'bungalow' => 'Bungalow',
        'townhouse' => 'Townhouse',
    ];

    const COMMERCIAL_PROPERTY_TYPES = [
        'shop' => 'Shop',
        'office' => 'Office',
    ];

    // ================================================================
    // Unit Style Constants (residential only, multi-select)
    // ================================================================
    const UNIT_STYLES = [
        'studio' => 'Studio',
        'penthouse' => 'Penthouse',
        'loft' => 'Loft',
        'garden_apartment' => 'Garden Apartment',
        'duplex' => 'Duplex',
        'triplex' => 'Triplex',
    ];

    // ================================================================
    // View Type Constants (multi-select)
    // ================================================================
    const VIEW_TYPES = [
        'sea_front' => 'Sea Front (Direct)',
        'sea_view' => 'Sea View',
        'mountain_view' => 'Mountain View',
        'pool_view' => 'Pool View',
        'garden_view' => 'Garden View',
        'city_view' => 'City View',
    ];

    // ================================================================
    // Furniture Status Constants
    // ================================================================
    const FURNITURE_STATUSES = [
        'unfurnished' => 'Unfurnished',
        'part_furnished' => 'Part Furnished',
        'white_goods_only' => 'White Goods Only',
        'fully_furnished' => 'Fully Furnished',
    ];

    // ================================================================
    // Currency Constants
    // ================================================================
    const CURRENCIES = [
        'EUR' => ['label' => 'Euro', 'symbol' => '€'],
        'GBP' => ['label' => 'British Pound', 'symbol' => '£'],
        'USD' => ['label' => 'US Dollar', 'symbol' => '$'],
        'TRY' => ['label' => 'Turkish Lira', 'symbol' => '₺'],
    ];

    // ================================================================
    // Floor Options
    // ================================================================
    const FLOOR_OPTIONS = [
        'basement' => 'Basement (-1)',
        'ground' => 'Ground Floor (0)',
        '1' => '1st Floor',
        '2' => '2nd Floor',
        '3' => '3rd Floor',
        '4' => '4th Floor',
        '5' => '5th Floor',
        '6' => '6th Floor',
        '7' => '7th Floor',
        '8' => '8th Floor',
        '9' => '9th Floor',
        '10' => '10th Floor',
        '11' => '11th Floor',
        '12' => '12th Floor',
        '13' => '13th Floor',
        '14' => '14th Floor',
        '15+' => '15th Floor+',
    ];

    // ================================================================
    // Outside Features (12 items)
    // ================================================================
    const OUTSIDE_FEATURES = [
        'barbeque' => 'Barbeque',
        'bounding_wall' => 'Bounding Wall',
        'double_glazing' => 'Double Glazing',
        'garage' => 'Garage',
        'garden' => 'Garden',
        'generator' => 'Generator',
        'lift' => 'Lift',
        'private_pool' => 'Private Pool',
        'terrace' => 'Terrace',
        'thermal_insulation' => 'Thermal Insulation',
        'water_tank' => 'Water Tank',
        'jacuzzi' => 'Jacuzzi',
    ];

    // ================================================================
    // Inside Features (18 items)
    // ================================================================
    const INSIDE_FEATURES = [
        'air_condition' => 'Air Condition',
        'bath_tube' => 'Bath Tube',
        'blind' => 'Blind',
        'ceramic' => 'Ceramic',
        'closet' => 'Closet',
        'entryphone' => 'Entryphone',
        'fire_alarm' => 'Fire Alarm',
        'fireplace' => 'Fireplace',
        'laundry' => 'Laundry',
        'master_room_bath' => 'Master Room Bath',
        'panel_door' => 'Panel Door',
        'pantry' => 'Pantry',
        'parquet' => 'Parquet',
        'solar_electric' => 'Solar Electric',
        'steel_door' => 'Steel Door',
        'tv_infrastructure' => 'TV Infrastructure',
        'wallpaper' => 'Wallpaper',
        'water_booster' => 'Water Booster',
    ];

    // ================================================================
    // Fillable Fields
    // ================================================================
    protected $fillable = [
        'company_id',
        'developer_project_id',
        'reference_code',
        'primary_category',
        'property_type',
        'quantity',
        'unit_style',
        'view_types',
        'furniture_status',
        'starting_price',
        'currency',
        'bedrooms',
        'bathrooms',
        'floor',
        'floors_in_building',
        'total_area_sqm',
        'living_area_sqm',
        'terrace_balcony_sqm',
        'plot_size_sqm',
        'completion_date',
        'outside_features',
        'inside_features',
        'description',
        'military_base_distance_km',
        'has_restrictions',
        'restriction_notes',
        'order',
    ];

    // ================================================================
    // Appended Accessors
    // ================================================================

    /**
     * These computed attributes are automatically included in toArray() / JSON
     * serialization so that Inertia delivers them to the frontend.
     *
     * display_label   → human-readable card title (e.g. "2+1 Apartment")
     * formatted_price → price with currency symbol (e.g. "£250,000")
     * currency_symbol → just the symbol (e.g. "£", "€")
     */
    protected $appends = [
        'display_label',
        'formatted_price',
        'currency_symbol',
    ];

    // ================================================================
    // Casts
    // ================================================================
    protected $casts = [
        'unit_style' => 'array',
        'view_types' => 'array',
        'outside_features' => 'array',
        'inside_features' => 'array',
        'starting_price' => 'decimal:2',
        'total_area_sqm' => 'decimal:2',
        'living_area_sqm' => 'decimal:2',
        'terrace_balcony_sqm' => 'decimal:2',
        'plot_size_sqm' => 'decimal:2',
        'military_base_distance_km' => 'decimal:2',
        'quantity' => 'integer',
        'bedrooms' => 'integer',
        'bathrooms' => 'integer',
        'floors_in_building' => 'integer',
        'has_restrictions' => 'boolean',
        'completion_date' => 'date',
        'order' => 'integer',
    ];

    // ================================================================
    // Relationships
    // ================================================================

    /**
     * The developer project this unit type belongs to.
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(DeveloperProject::class, 'developer_project_id');
    }

    /**
     * Assets (photos) for this unit type.
     */
    public function assets(): HasMany
    {
        return $this->hasMany(DeveloperProjectUnitTypeAsset::class, 'unit_type_id');
    }

    // ================================================================
    // Scopes
    // ================================================================

    /**
     * Filter by primary category.
     */
    public function scopeByCategory($query, string $category)
    {
        return $query->where('primary_category', $category);
    }

    /**
     * Order by the `order` column.
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('order')->orderBy('id');
    }

    // ================================================================
    // Reference Code Generation
    // ================================================================

    /**
     * Generate a reference code for this unit type.
     * Pattern: DEVELOPER-NNN-UTxx
     * e.g., AKACAN-001-UT01
     *
     * @return string
     */
    public function generateReferenceCode(): string
    {
        $project = $this->project()->with('developer')->first();

        // Get project ref code or generate one
        $projectRef = $project->reference_code;
        if (!$projectRef) {
            $projectRef = $project->generateReferenceCode();
            $project->update(['reference_code' => $projectRef]);
        }

        // Find the highest existing UT number for this project
        // Use withTrashed() because the DB unique constraint includes soft-deleted rows.
        $maxNumber = static::withTrashed()
            ->where('developer_project_id', $this->developer_project_id)
            ->where('id', '!=', $this->id ?? 0)
            ->whereNotNull('reference_code')
            ->where('reference_code', 'like', $projectRef . '-UT%')
            ->pluck('reference_code')
            ->map(function ($code) use ($projectRef) {
                // Extract numeric part after "-UT" (e.g., "AKACAN-001-UT03" → 3)
                $suffix = str_replace($projectRef . '-UT', '', $code);
                return is_numeric($suffix) ? (int) $suffix : 0;
            })
            ->max();

        $unitNumber = str_pad(($maxNumber ?? 0) + 1, 2, '0', STR_PAD_LEFT);

        return $projectRef . '-UT' . $unitNumber;
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Get property types available for the current primary category.
     */
    public function getAvailablePropertyTypes(): array
    {
        return $this->primary_category === self::CATEGORY_COMMERCIAL
            ? self::COMMERCIAL_PROPERTY_TYPES
            : self::RESIDENTIAL_PROPERTY_TYPES;
    }

    /**
     * Get the currency symbol.
     */
    public function getCurrencySymbolAttribute(): string
    {
        return self::CURRENCIES[$this->currency]['symbol'] ?? '£';
    }

    /**
     * Get formatted price with currency symbol.
     */
    public function getFormattedPriceAttribute(): ?string
    {
        if (!$this->starting_price) return null;
        return $this->currency_symbol . number_format((float) $this->starting_price, 0);
    }

    /**
     * Get a display label for the unit type.
     * e.g., "2+1 Apartment" or "Studio Penthouse"
     */
    public function getDisplayLabelAttribute(): string
    {
        $parts = [];

        if ($this->bedrooms !== null) {
            $parts[] = $this->bedrooms . '+1';
        }

        $types = $this->primary_category === self::CATEGORY_COMMERCIAL
            ? self::COMMERCIAL_PROPERTY_TYPES
            : self::RESIDENTIAL_PROPERTY_TYPES;

        if ($this->property_type && isset($types[$this->property_type])) {
            $parts[] = $types[$this->property_type];
        }

        return implode(' ', $parts) ?: 'Unit Type';
    }
}
