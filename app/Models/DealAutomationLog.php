<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DealAutomationLog extends BaseModel
{
    use HasCompany, HasFactory;

    protected $table = 'deal_automation_logs';

    public const STATUS_SUCCESS = 'success';

    public const STATUS_FAILED = 'failed';

    public const STATUS_SKIPPED = 'skipped';

    public const CHANNELS = ['stage', 'field', 'lock', 'email', 'task', 'note', 'meta', 'wait'];

    protected $fillable = [
        'company_id',
        'deal_id',
        'lead_id',
        'automation_id',
        'run_id',
        'action',
        'status',
        'channel',
        'details',
        'executed_at',
    ];

    protected $casts = [
        'details' => 'array',
        'executed_at' => 'datetime',
    ];

    // ── Relationships ────────────────────────────────────────────

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function automation(): BelongsTo
    {
        return $this->belongsTo(DealAutomation::class, 'automation_id');
    }
}
