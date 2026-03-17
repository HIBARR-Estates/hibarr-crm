<?php

namespace App\Observers;

use App\Models\LeadAgent;
use App\Services\LevelService;

class LeadAgentObserver
{
    public function __construct(protected LevelService $levelService)
    {
    }

    public function saving(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $leadAgent->last_updated_by = user()->id;
        }
    }

    public function creating(LeadAgent $leadAgent)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $leadAgent->added_by = user()->id;
        }

        if (company()) {
            $leadAgent->company_id = company()->id;
        }
    }

    /**
     * After a new agent is created, assign the base MLM level.
     */
    public function created(LeadAgent $leadAgent): void
    {
        $this->levelService->assignBaseLevel($leadAgent);
    }
}
