<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A partner's flag on one of their own referrals.
 *
 * @property int $id
 * @property int $company_id
 * @property int $lead_agent_id
 * @property int $lead_id
 * @property string $reason
 * @property string|null $message
 * @property string $status
 * @property string|null $response
 * @property int|null $resolved_by
 * @property \Illuminate\Support\Carbon|null $resolved_at
 *
 * @mixin \Eloquent
 */
class PartnerFlag extends BaseModel
{
    use HasCompany;

    public const STATUS_OPEN = 'open';

    public const STATUS_ACKNOWLEDGED = 'acknowledged';

    public const STATUS_RESOLVED = 'resolved';

    /** Why a partner raised it. Kept short and closed — free text is `message`. */
    public const REASONS = ['stalled', 'wrong_contact', 'other'];

    protected $fillable = [
        'company_id',
        'lead_agent_id',
        'lead_id',
        'reason',
        'message',
        'status',
        'response',
        'resolved_by',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function partner(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'lead_agent_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function resolver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function scopeOpen($query)
    {
        return $query->whereIn('status', [self::STATUS_OPEN, self::STATUS_ACKNOWLEDGED]);
    }
}
