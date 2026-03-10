<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MlmLevel extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_levels';

    protected $fillable = [
        'company_id',
        'name',
        'slug',
        'rank',
        'commission_percentage',
    ];

    protected $casts = [
        'rank' => 'integer',
        'commission_percentage' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function criteria(): HasMany
    {
        return $this->hasMany(MlmLevelCriterion::class, 'mlm_level_id');
    }

    public function levelHistory(): HasMany
    {
        return $this->hasMany(AgentLevelHistory::class, 'level_id');
    }

    // ── Scopes ───────────────────────────────────────────────────

    /**
     * Order levels by rank ascending (lowest rank = lowest level).
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('rank', 'asc');
    }

    /**
     * Order levels by rank descending (highest rank first).
     */
    public function scopeOrderedDesc($query)
    {
        return $query->orderBy('rank', 'desc');
    }
}
