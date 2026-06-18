<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentCommissionRateAuditLog extends BaseModel
{
    use HasCompany;

    protected $table = 'agent_commission_rate_audit_logs';

    protected $fillable = [
        'company_id',
        'agent_id',
        'changed_by_user_id',
        'previous_direct_rate',
        'new_direct_rate',
        'previous_override_rate',
        'new_override_rate',
        'changed_at',
        'reason',
    ];

    protected $casts = [
        'previous_direct_rate' => 'decimal:2',
        'new_direct_rate' => 'decimal:2',
        'previous_override_rate' => 'decimal:2',
        'new_override_rate' => 'decimal:2',
        'changed_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function () {
            throw new \RuntimeException('Agent commission rate audit logs are immutable.');
        });

        static::deleting(function () {
            throw new \RuntimeException('Agent commission rate audit logs are immutable.');
        });
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function changedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by_user_id');
    }
}
