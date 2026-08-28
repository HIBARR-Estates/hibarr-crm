<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAutomationLog extends BaseModel
{
    use HasFactory;
    use HasCompany;

    protected $table = 'lead_automation_logs';

    protected $fillable = [
        'company_id',
        'lead_id',
        'automation_id',
        'action',
        'result',
        'details',
        'executed_at',
    ];

    protected $casts = [
        'details' => 'array',
        'executed_at' => 'datetime',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function automation(): BelongsTo
    {
        return $this->belongsTo(LeadAutomation::class, 'automation_id');
    }
}
