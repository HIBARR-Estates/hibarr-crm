<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealAutomationLog extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'deal_automation_logs';

    protected $fillable = [
        'company_id',
        'deal_id',
        'automation_id',
        'action',
        'executed_at',
    ];

    protected $casts = [
        'executed_at' => 'datetime',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function automation(): BelongsTo
    {
        return $this->belongsTo(DealAutomation::class, 'automation_id');
    }
}
