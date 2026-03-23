<?php

namespace App\Models;

use App\Enums\CycleDurationType;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlmSetting extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_settings';

    protected $fillable = [
        'company_id',
        'max_commission_percentage',
        'auto_evaluate_ancestors',
        'enable_commission_reversal',
        'auto_generate_cycles',
        'default_cycle_duration_type',
        'default_cycle_duration_days',
        'default_overflow_multiplier',
    ];

    protected $casts = [
        'max_commission_percentage' => 'decimal:2',
        'auto_evaluate_ancestors' => 'boolean',
        'enable_commission_reversal' => 'boolean',
        'auto_generate_cycles' => 'boolean',
        'default_cycle_duration_type' => CycleDurationType::class,
        'default_cycle_duration_days' => 'integer',
        'default_overflow_multiplier' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * Get or create settings for a company, using sensible defaults.
     */
    public static function forCompany(int $companyId): self
    {
        return static::firstOrCreate(
            ['company_id' => $companyId],
            [
                'max_commission_percentage' => config('mlm.max_commission_percentage', 10),
                'auto_evaluate_ancestors' => config('mlm.auto_evaluate_ancestors', true),
                'enable_commission_reversal' => true,
                'auto_generate_cycles' => config('mlm.cycle.auto_generate', true),
                'default_cycle_duration_type' => config('mlm.cycle.default_duration_type', 'monthly'),
                'default_cycle_duration_days' => null,
                'default_overflow_multiplier' => config('mlm.cycle.default_max_overflow_multiplier', 1.00),
            ]
        );
    }

    /**
     * Resolved default cycle duration in days.
     */
    public function getDefaultDurationDaysResolvedAttribute(): int
    {
        return match ($this->default_cycle_duration_type) {
            CycleDurationType::Monthly => 30,
            CycleDurationType::Quarterly => 90,
            CycleDurationType::Custom => $this->default_cycle_duration_days ?? 30,
            default => 30,
        };
    }

    /**
     * Calculate end date for a cycle starting on a given date using default settings.
     */
    public function calculateDefaultEndDate(\Carbon\Carbon $startDate): \Carbon\Carbon
    {
        return match ($this->default_cycle_duration_type) {
            CycleDurationType::Monthly => $startDate->copy()->addMonth()->subDay(),
            CycleDurationType::Quarterly => $startDate->copy()->addMonths(3)->subDay(),
            CycleDurationType::Custom => $startDate->copy()->addDays($this->default_cycle_duration_days ?? 30)->subDay(),
            default => $startDate->copy()->addMonth()->subDay(),
        };
    }
}
