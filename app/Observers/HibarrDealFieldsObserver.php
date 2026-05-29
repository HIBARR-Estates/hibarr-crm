<?php

namespace App\Observers;

use App\Models\HibarrDealFields;
use App\Services\DealAssociatableFieldEventRecorder;

class HibarrDealFieldsObserver
{
    public function updated(HibarrDealFields $fields): void
    {
        app(DealAssociatableFieldEventRecorder::class)->recordHibarrFieldChanges($fields);
    }
}
