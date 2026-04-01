<?php

namespace App\Observers;

use App\Models\LeadAgent;
use App\Services\LevelService;
use App\Services\CycleService;

class LeadAgentObserver
{
    public function __construct(
        protected LevelService $levelService,
        protected CycleService $cycleService,
    ) {
    }

    public function saving(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $currentUserId = auth()->id();
            if ($currentUserId) {
                $leadAgent->last_updated_by = $currentUserId;
            }
        }
    }

    public function creating(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $currentUserId = auth()->id();
            if ($currentUserId) {
                $leadAgent->added_by = $currentUserId;
            }
        }

        if (empty($leadAgent->company_id)) {
            $currentUser = auth()->user();
            if ($currentUser && !empty($currentUser->company_id)) {
                $leadAgent->company_id = $currentUser->company_id;
            }
        }
    }

    /**
     * After a new agent is created, assign the base MLM level and enroll in the active cycle.
     */
    public function created(LeadAgent $leadAgent): void
    {
        $this->levelService->assignBaseLevel($leadAgent);
        $this->cycleService->ensureEnrollment($leadAgent);
    }
}
