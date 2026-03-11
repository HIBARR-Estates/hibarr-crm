<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentMetric extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'agent_metrics';

    protected $fillable = [
        'company_id',
        'agent_id',
        'nsa',
        'nsd',
        'vsa',
        'vsd',
    ];

    protected $casts = [
        'nsa' => 'integer',
        'nsd' => 'integer',
        'vsa' => 'decimal:2',
        'vsd' => 'decimal:2',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'agent_id');
    }
}
