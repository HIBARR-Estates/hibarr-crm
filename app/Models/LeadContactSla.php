<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The first-contact clock of one lead entry. See LeadContactSlaService for how it starts, ends and
 * is flagged.
 */
class LeadContactSla extends BaseModel
{
    use HasCompany;

    public const STATUS_AWAITING_OWNER = 'awaiting_owner';

    public const STATUS_RUNNING = 'running';

    public const STATUS_MET = 'met';

    protected $table = 'lead_contact_slas';

    protected $guarded = ['id'];

    protected $casts = [
        'window' => 'array',
        'started_at' => 'datetime',
        'due_at' => 'datetime',
        'breached_at' => 'datetime',
        'contacted_at' => 'datetime',
        'used_recommended_method' => 'boolean',
        'met_in_time' => 'boolean',
        'first_contact_seconds' => 'integer',
        'elapsed_working_seconds' => 'integer',
    ];

    public function entry(): BelongsTo
    {
        return $this->belongsTo(LeadEntry::class, 'lead_entry_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }
}
