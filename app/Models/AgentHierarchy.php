<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentHierarchy extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'agent_hierarchy';

    protected $fillable = [
        'company_id',
        'ancestor_id',
        'descendant_id',
        'depth',
    ];

    protected $casts = [
        'depth' => 'integer',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function ancestor(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'ancestor_id');
    }

    public function descendant(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'descendant_id');
    }
}
