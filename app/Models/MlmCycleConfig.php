<?php

namespace App\Models;

use App\Enums\CycleDurationType;
use App\Traits\HasCompany;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MlmCycleConfig extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_cycle_configs';

    protected $fillable = [
        'company_id',
        'duration_type',
        'duration_days',
        'anchor_date',
        'max_overflow_multiplier',
        'auto_generate',
    ];

    protected $casts = [
        'duration_type' => CycleDurationType::class,
        'anchor_date' => 'date',
        'max_overflow_multiplier' => 'decimal:2',
        'auto_generate' => 'boolean',
        'duration_days' => 'integer',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function cycles(): HasMany
    {
        return $this->hasMany(MlmCycle::class, 'cycle_config_id');
    }

    // ── Computed ─────────────────────────────────────────────────

    /**
     * Get the effective cycle duration in days.
     *
     * For monthly: calculates based on anchor_date month length.
     * For quarterly: ~90 days.
     * For custom: uses stored duration_days.
     */
    public function getDurationDaysResolvedAttribute(): int
    {
        return match ($this->duration_type) {
            CycleDurationType::Monthly => 30,
            CycleDurationType::Quarterly => 90,
            CycleDurationType::Custom => $this->duration_days ?? 30,
        };
    }

    /**
     * Calculate the end date for a cycle starting on the given date.
     * For monthly/quarterly, uses calendar-aware date math.
     */
    public function calculateEndDate(Carbon $startDate): Carbon
    {
        return match ($this->duration_type) {
            CycleDurationType::Monthly => $startDate->copy()->addMonth()->subDay(),
            CycleDurationType::Quarterly => $startDate->copy()->addMonths(3)->subDay(),
            CycleDurationType::Custom => $startDate->copy()->addDays($this->duration_days ?? 30)->subDay(),
        };
    }

    /**
     * Get the maximum overflow days based on multiplier.
     */
    public function getMaxOverflowDaysAttribute(): int
    {
        return (int) round($this->duration_days_resolved * (float) $this->max_overflow_multiplier);
    }
}
