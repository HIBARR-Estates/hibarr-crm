<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CrmBusinessRule extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'crm_business_rules';

    protected $fillable = [
        'company_id',
        'name',
        'slug',
        'description',
        'rule_config',
        'is_active',
    ];

    protected $casts = [
        'rule_config' => 'array',
        'is_active' => 'boolean',
    ];

    // ─── Relationships ───────────────────────────────────────────

    /**
     * Get the event types that reference this business rule.
     */
    public function eventTypes(): HasMany
    {
        return $this->hasMany(CrmEventType::class, 'business_rule_id');
    }

    // ─── Scopes ──────────────────────────────────────────────────

    /**
     * Scope to only active business rules.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
