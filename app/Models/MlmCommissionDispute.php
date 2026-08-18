<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlmCommissionDispute extends BaseModel
{
    use HasCompany;

    public const STATUS_OPEN = 'open';

    public const STATUS_RESOLVED = 'resolved';

    protected $table = 'mlm_commission_disputes';

    protected $fillable = [
        'company_id',
        'commission_id',
        'agent_id',
        'reason',
        'message',
        'status',
        'resolved_by',
        'resolved_at',
        'resolution_note',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function commission(): BelongsTo
    {
        return $this->belongsTo(MlmCommission::class, 'commission_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }
}
