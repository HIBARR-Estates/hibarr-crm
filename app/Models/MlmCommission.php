<?php

namespace App\Models;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlmCommission extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'mlm_commissions';

    protected $fillable = [
        'company_id',
        'deal_id',
        'agent_id',
        'source_agent_id',
        'level_id',
        'cycle_level_snapshot_id',
        'percentage',
        'amount',
        'type',
        'status',
        'paid_at',
        'reverted_at',
        'reverted_reason',
    ];

    protected $casts = [
        'type' => MlmCommissionType::class,
        'status' => MlmCommissionStatus::class,
        'percentage' => 'decimal:2',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'reverted_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => 'pending',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function sourceAgent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'source_agent_id');
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(MlmLevel::class, 'level_id');
    }

    public function cycleLevelSnapshot(): BelongsTo
    {
        return $this->belongsTo(MlmCycleLevelSnapshot::class, 'cycle_level_snapshot_id');
    }

    // ── Status Transitions ───────────────────────────────────────

    /**
     * Mark the commission as paid (admin acceptance / payout).
     *
     * @throws \DomainException
     */
    public function markPaid(): void
    {
        $updated = static::query()
            ->whereKey($this->getKey())
            ->where('status', MlmCommissionStatus::Pending->value)
            ->update([
                'status' => MlmCommissionStatus::Paid->value,
                'paid_at' => now(),
            ]);

        if ($updated !== 1) {
            throw new \DomainException('Only pending commissions can be marked as paid.');
        }

        $this->refresh();
    }

    /**
     * Revert a pending commission with a reason.
     *
     * @throws \DomainException
     */
    public function revert(string $reason): void
    {
        $updated = static::query()
            ->whereKey($this->getKey())
            ->where('status', MlmCommissionStatus::Pending->value)
            ->update([
                'status' => MlmCommissionStatus::Reverted->value,
                'reverted_at' => now(),
                'reverted_reason' => $reason,
            ]);

        if ($updated !== 1) {
            throw new \DomainException('Only pending commissions can be reverted.');
        }

        $this->refresh();
    }

    /**
     * Claw back a previously paid commission.
     *
     * @throws \DomainException
     */
    public function clawback(string $reason): void
    {
        $updated = static::query()
            ->whereKey($this->getKey())
            ->where('status', MlmCommissionStatus::Paid->value)
            ->update([
                'status' => MlmCommissionStatus::Reverted->value,
                'reverted_at' => now(),
                'reverted_reason' => $reason,
            ]);

        if ($updated !== 1) {
            throw new \DomainException('Only paid commissions can be clawed back.');
        }

        $this->refresh();
    }
}
