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
use Illuminate\Support\Facades\Log;

class ResolveCommunicationActivityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;


    // Exponential backoff for retries & try at least 3 times before marking as unresolved
        /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The maximum number of unhandled exceptions to allow before failing.
     */
    public $maxExceptions = 3;

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        return [
            60,      // First retry after 1 minute
            300,     // Second retry after 5 minutes  
            900,     // Third retry after 15 minutes
        ];
    }

    protected int $activityId;
    protected int $maxResolutionAttempts = 3;
    protected bool $can_create_deal = true; 

    /**
     * Create a new job instance.
     */
    public function __construct(int $activityId, bool $can_create_deal = true)
    {
        $this->activityId = $activityId;
        $this->can_create_deal = $can_create_deal;

        // Set queue to resolvers for better organization
        $this->onQueue('resolvers');
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

        try {
            // Attempt to resolve
            $resolver->resolve($activity);

            Log::info("Attempting to create deal for activity {$activity->id} linked to lead {$activity->lead_id}  can_create_deal: " . ($this->can_create_deal ? 'true' : 'false') . "deal_id: " . ($activity->deal_id ?? 'null') . " lead_id: " . ($activity->lead_id ?? 'null'));
                
            if($this->can_create_deal && empty($activity->deal_id) && isset($activity->lead_id)) {
                Log::info("Attempting to create deal for activity {$activity->id} linked to lead {$activity->lead_id}");
                $resolver->createDealIfNeeded($activity);
            }

            // Check if resolution was successful
            if (!empty($activity->deal_id) || !empty($activity->lead_id)) {
                $activity->resolution_status = ResolutionStatus::Resolved->value;
                $activity->save();
                return;
            }

            // If still not resolved after max attempts, mark as unresolved
            if ($activity->resolution_attempts >= $this->maxResolutionAttempts) {
                $activity->resolution_status = ResolutionStatus::Unresolved->value;
                $activity->save();
                return;
            }

            // If not at max attempts yet, throw exception to trigger retry
            throw new \Exception("Resolution attempt {$activity->resolution_attempts} failed. Will retry.");

        } catch (\Exception $e) {
            $activity->save(); // Save attempt count even on failure
            
            // If we've reached max attempts, mark as unresolved and don't retry
            if ($activity->resolution_attempts >= $this->maxResolutionAttempts) {
                $activity->resolution_status = ResolutionStatus::Unresolved->value;
                $activity->save();
                
                // Don't retry - let the job fail silently
                $this->fail($e);
                return;
            }

            // Re-throw to trigger retry mechanism
            throw $e;
        }        
    }

     /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $activity = CommunicationActivity::find($this->activityId);
        
        if ($activity) {
            $activity->resolution_status = ResolutionStatus::Unresolved->value;
            $activity->save();
        }

        \Log::error('ResolveCommunicationActivityJob failed', [
            'activity_id' => $this->activityId,
            'attempts' => $activity?->resolution_attempts ?? 0,
            'error' => $exception->getMessage()
        ]);
    }

}