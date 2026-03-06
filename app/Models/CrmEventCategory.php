<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmEventCategory extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'crm_event_categories';

    protected $fillable = [
        'company_id',
        'name',
        'slug',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    // ─── Relationships ───────────────────────────────────────────

    /**
     * Get the event types belonging to this category.
     */
    public function eventTypes(): HasMany
    {
        return $this->hasMany(CrmEventType::class, 'category_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to only active categories.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
