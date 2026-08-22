<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A queued "run this automation's actions later" row — created when a
 * triggered automation has a wait configured and its conditions passed at
 * trigger time. Drained by deal-automations:process-pending-runs once
 * run_at is due; conditions are re-checked at execution time because the
 * deal/lead may have changed during the wait.
 *
 * @property int $id
 * @property int $deal_automation_id
 * @property int|null $company_id
 * @property string $subject_type DealAutomation::SUBJECT_DEAL|SUBJECT_LEAD
 * @property int $subject_id
 * @property string|null $trigger
 * @property \Illuminate\Support\Carbon $run_at
 */
class DealAutomationPendingRun extends BaseModel
{
    use HasFactory;

    protected $table = 'deal_automation_pending_runs';

    protected $fillable = [
        'deal_automation_id',
        'company_id',
        'subject_type',
        'subject_id',
        'trigger',
        'run_at',
    ];

    protected $casts = [
        'run_at' => 'datetime',
    ];

    public function automation(): BelongsTo
    {
        return $this->belongsTo(DealAutomation::class, 'deal_automation_id');
    }
}
