<?php

namespace App\Observers;

use App\Models\LeadMarketing;
use App\Services\DealAssociatableFieldEventRecorder;

class LeadMarketingObserver
{
    public function updated(LeadMarketing $marketing): void
    {
        app(DealAssociatableFieldEventRecorder::class)->recordLeadMarketingFieldChanges($marketing);
    }
}
