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
 * @property int|null $resume_action_id The action to resume at when this run
 *                                      was queued mid-sequence by a "wait" step, rather than the automation's
 *                                      own pre-actions wait — null means start from the first action.
 * @property string|null $run_id The execution this row resumes, so steps that
 *                               ran before the wait and steps that run after it share one run in the log.
 *                               Null for a pre-actions wait, which starts a fresh run when it executes.
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
        'resume_action_id',
        'run_id',
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
