<?php

namespace App\Models;

use App\Enums\CycleStatus;
use App\Traits\HasCompany;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MlmCycle extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_cycles';

    protected $fillable = [
        'company_id',
        'cycle_config_id',
        'cycle_number',
        'start_date',
        'end_date',
        'status',
    ];

    protected $casts = [
        'cycle_number' => 'integer',
        'start_date' => 'date',
        'end_date' => 'date',
        'status' => CycleStatus::class,
    ];

    // ── Relationships ────────────────────────────────────────────

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function config(): BelongsTo
    {
        return $this->belongsTo(MlmCycleConfig::class, 'cycle_config_id');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(AgentCycleEnrollment::class, 'cycle_id');
    }

    // ── Scopes ───────────────────────────────────────────────────

    /**
     * Scope to active cycles for a company.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', CycleStatus::Active);
    }

    /**
     * Scope to find the cycle that contains a given date.
     */
    public function scopeForDate(Builder $query, Carbon $date): Builder
    {
        return $query->where('start_date', '<=', $date)
            ->where('end_date', '>=', $date);
    }

    /**
     * Scope to upcoming cycles.
     */
    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', CycleStatus::Upcoming);
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Duration of this cycle in days.
     */
    public function getDurationDaysAttribute(): int
    {
        return $this->start_date->diffInDays($this->end_date) + 1;
    }

    /**
     * Whether a given date falls within this cycle's date range.
     */
    public function containsDate(Carbon $date): bool
    {
        return $date->between($this->start_date, $this->end_date);
    }

    /**
     * Whether this cycle is currently active based on real dates (regardless of status column).
     */
    public function isCurrentlyActive(): bool
    {
        $today = now()->startOfDay();
        return $today->between($this->start_date, $this->end_date);
    }
}
