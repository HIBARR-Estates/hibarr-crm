<?php

namespace Modules\Webhooks\Observers;

use App\Models\Lead;
use Modules\Webhooks\Jobs\SendWebhook;

class LeadObserver
{

    public function created(Lead $lead)
    {
        SendWebhook::dispatch($lead->toArray(), 'Lead', $lead->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}
