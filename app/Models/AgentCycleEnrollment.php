<?php

namespace App\Models;

use App\Enums\EnrollmentStatus;
use App\Traits\HasCompany;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AgentCycleEnrollment extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'agent_cycle_enrollments';

    protected $fillable = [
        'company_id',
        'agent_id',
        'cycle_id',
        'effective_start_date',
        'effective_end_date',
        'status',
        'criteria_met_at',
        'overflow_start_date',
        'max_overflow_date',
        'level_achieved_id',
    ];

    protected $casts = [
        'effective_start_date' => 'date',
        'effective_end_date' => 'date',
        'status' => EnrollmentStatus::class,
        'criteria_met_at' => 'datetime',
        'overflow_start_date' => 'date',
        'max_overflow_date' => 'date',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(MlmCycle::class, 'cycle_id');
    }

    public function metrics(): HasOne
    {
        return $this->hasOne(AgentCycleMetric::class, 'enrollment_id');
    }

    public function levelAchieved(): BelongsTo
    {
        return $this->belongsTo(MlmLevel::class, 'level_achieved_id');
    }

    // ── Scopes ───────────────────────────────────────────────────

    /**
     * Enrollments that are currently receiving metrics (active or extended).
     */
    public function scopeReceiving(Builder $query): Builder
    {
        return $query->whereIn('status', [
            EnrollmentStatus::Active,
            EnrollmentStatus::Extended,
        ]);
    }

    /**
     * Enrollments in overflow state.
     */
    public function scopeExtended(Builder $query): Builder
    {
        return $query->where('status', EnrollmentStatus::Extended);
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Whether this enrollment is currently receiving metrics.
     */
    public function isReceivingMetrics(): bool
    {
        return $this->status->isReceivingMetrics();
    }

    /**
     * Whether this enrollment is in overflow.
     */
    public function isOverflowing(): bool
    {
        return $this->status === EnrollmentStatus::Extended;
    }

    /**
     * Whether the max overflow date has been exceeded.
     */
    public function isOverflowExpired(): bool
    {
        if (!$this->isOverflowing() || !$this->max_overflow_date) {
            return false;
        }

        return now()->startOfDay()->gt($this->max_overflow_date);
    }

    /**
     * Days remaining in this enrollment (including overflow if applicable).
     */
    public function daysRemaining(): int
    {
        $endDate = $this->isOverflowing()
            ? $this->max_overflow_date
            : $this->effective_end_date;

        if (!$endDate) {
            return 0;
        }

        return max(0, now()->startOfDay()->diffInDays($endDate, false));
    }

    /**
     * Get the enrollment's effective date range for metric attribution.
     * For deals to count, their won_at must fall within this range.
     */
    public function getMetricDateRange(): array
    {
        return [
            'start' => $this->effective_start_date,
            'end' => $this->effective_end_date ?? $this->max_overflow_date ?? $this->cycle->end_date,
        ];
    }
}
