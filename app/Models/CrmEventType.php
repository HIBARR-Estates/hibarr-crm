<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmEventType extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'crm_event_types';

    protected $fillable = [
        'company_id',
        'category_id',
        'name',
        'slug',
        'description',
        'model_type',
        'business_rule_id',
        'is_system',
        'is_active',
        'sync_processing',
        'metadata_schema',
    ];

    protected $casts = [
        'is_system' => 'boolean',
        'is_active' => 'boolean',
        'sync_processing' => 'boolean',
        'metadata_schema' => 'array',
    ];

    // ─── Relationships ───────────────────────────────────────────

    /**
     * Get the category this event type belongs to.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(CrmEventCategory::class, 'category_id');
    }

    /**
     * Get the business rule associated with this event type.
     */
    public function businessRule(): BelongsTo
    {
        return $this->belongsTo(CrmBusinessRule::class, 'business_rule_id');
    }

    /**
     * Get all events of this type.
     */
    public function events(): HasMany
    {
        return $this->hasMany(CrmEvent::class, 'event_type_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to only active event types.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to system-seeded event types.
     */
    public function scopeSystem($query)
    {
        return $query->where('is_system', true);
    }

    /**
     * Scope by slug.
     */
    public function scopeBySlug($query, string $slug)
    {
        return $query->where('slug', $slug);
    }

    /**
     * Scope by model type.
     */
    public function scopeForModel($query, string $modelType)
    {
        return $query->where('model_type', $modelType);
    }

    // ─── Helpers ─────────────────────────────────────────────────

    /**
     * Whether this event type should be processed asynchronously.
     */
    public function isAsync(): bool
    {
        return !$this->sync_processing;
    }
}
