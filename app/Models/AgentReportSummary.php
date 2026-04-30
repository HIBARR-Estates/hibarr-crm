<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentReportSummary extends BaseModel
{
    use HasCompany;

    protected $table = 'agent_report_summaries';

    protected $fillable = [
        'company_id',
        'title',
        'description',
        'summary',
        'filter_start_date',
        'filter_end_date',
        'filter_agent_id',
        'filter_view_type',
        'context_label',
        'added_by',
        'last_updated_by',
    ];

    protected $casts = [
        'filter_start_date' => 'date',
        'filter_end_date'   => 'date',
    ];

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function lastUpdatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'last_updated_by');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(LeadAgent::class, 'filter_agent_id');
    }
}
