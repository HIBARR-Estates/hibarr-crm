<?php

namespace Modules\Webhooks\Observers;

use App\Models\Proposal;
use Modules\Webhooks\Jobs\SendWebhook;

class ProposalObserver
{

    public function created(Proposal $proposal)
    {
        SendWebhook::dispatch($proposal->toArray(), 'Proposal', $proposal->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}
