<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentLevelHistory extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'agent_level_history';

    protected $fillable = [
        'company_id',
        'agent_id',
        'level_id',
        'cycle_level_snapshot_id',
        'assigned_at',
        'assigned_by',
        'system_assigned',
        'trigger_deal_id',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'system_assigned' => 'boolean',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }

    public function level(): BelongsTo
    {
        return $this->belongsTo(MlmLevel::class, 'level_id');
    }

    public function assignedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function triggerDeal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'trigger_deal_id');
    }

    public function cycleLevelSnapshot(): BelongsTo
    {
        return $this->belongsTo(MlmCycleLevelSnapshot::class, 'cycle_level_snapshot_id');
    }
}
