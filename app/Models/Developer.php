<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Developer Model
 * 
 * Represents a real estate developer/company that owns multiple development projects.
 * Each developer is company-scoped (multi-tenant) and can have:
 * - Basic info (name, logo, description)
 * - Multiple DeveloperProjects (1:Many)
 * - Multiple Offers (1:Many)
 */
class Developer extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    protected $fillable = [
        'company_id',
        'name',
        'logo_url',
        'description',
        'project_list',
        'whatsapp_group_link',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'project_list' => 'array',
    ];

    /**
     * Get all developer projects owned by this developer.
     * 
     * A developer can own multiple projects, but each project
     * can only belong to one developer at a time.
     */
    public function projects(): HasMany
    {
        return $this->hasMany(DeveloperProject::class);
    }

    /**
     * Get all offers owned by this developer.
     */
    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class);
    }

    /**
     * Get the count of projects owned by this developer.
     */
    public function getProjectCountAttribute(): int
    {
        return $this->projects()->count();
    }

    /**
     * Get the total count of properties across all projects.
     */
    public function getTotalPropertyCountAttribute(): int
    {
        return Property::whereIn('developer_project_id', $this->projects()->pluck('id'))->count();
    }

    /**
     * Check if the developer has any projects.
     */
    public function hasProjects(): bool
    {
        return $this->projects()->exists();
    }

    /**
     * Get the logo URL or a default placeholder.
     */
    public function getLogoAttribute(): ?string
    {
        return $this->logo_url;
    }
}
