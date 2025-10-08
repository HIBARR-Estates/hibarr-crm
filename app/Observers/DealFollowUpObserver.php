<?php

namespace App\Observers;

use App\Models\DealFollowUp;
use App\Services\DealAutomationService;

class DealFollowUpObserver
{
    protected DealAutomationService $dealAutomation;

    public function __construct(
    DealAutomationService $dealAutomation
    ) {
        $this->dealAutomation = $dealAutomation;
    }
    /**
     * Handle the DealFollowUp "created" event.
     */
    public function created(DealFollowUp $dealFollowUp): void
    {
        //deal automation trigger
        $this->dealAutomation->automate($dealFollowUp->lead);
    }

    /**
     * Handle the DealFollowUp "updated" event.
     */
    public function updated(DealFollowUp $dealFollowUp): void
    {
        //
    }

    /**
     * Handle the DealFollowUp "deleted" event.
     */
    public function deleted(DealFollowUp $dealFollowUp): void
    {
        //
    }

    /**
     * Handle the DealFollowUp "restored" event.
     */
    public function restored(DealFollowUp $dealFollowUp): void
    {
        //
    }

    /**
     * Handle the DealFollowUp "force deleted" event.
     */
    public function forceDeleted(DealFollowUp $dealFollowUp): void
    {
        //
    }
}
