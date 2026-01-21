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
 * - Is tied to a ProjectLocation (1:1)
 * - Has an ExposeConfig for PDF generation (1:1)
 * - Contains multiple Properties (1:Many)
 * 
 * Future: Will also belong to a Developer entity (Many:1)
 */
class DeveloperProject extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'description',
        'project_location_id',
    ];

    /**
     * Eager load these relations by default
     */
    protected $with = [];

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
}
