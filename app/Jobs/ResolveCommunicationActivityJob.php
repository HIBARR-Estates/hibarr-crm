<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Services\CommunicationActivityResolverService;
use App\Models\CommunicationActivity;
use App\Enums\ResolutionStatus;

class ResolveCommunicationActivityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;


    // TODO: Implement exponential backoff for retries & try at least 3 times before marking as unresolved

    protected int $activityId;
    protected int $maxResolutionAttempts = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(int $activityId)
    {
        $this->activityId = $activityId;
    }

    /**
     * Execute the job.
     */
    public function handle(CommunicationActivityResolverService $resolver): void
    {
        $activity = CommunicationActivity::find($this->activityId);

        if (!$activity) {
            return;
        }

        // Increment resolution attempts and update timestamp
        $activity->resolution_attempts = ($activity->resolution_attempts ?? 0) + 1;
        $activity->last_resolution_attempt_at = now();

        // Attempt to resolve
        $resolver->resolve($activity);

        // If still not resolved, update status
        if (empty($activity->deal_id) && empty($activity->lead_id)) {
            // After maxResolutionAttempts, mark as unresolved
            if ($activity->resolution_attempts >= $this->maxResolutionAttempts) {
                $activity->resolution_status = ResolutionStatus::Unresolved->value;
            }
        } else {
            $activity->resolution_status = ResolutionStatus::Resolved->value;
        }

        $activity->save();
    }

}