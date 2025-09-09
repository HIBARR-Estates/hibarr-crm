<?php

namespace Modules\Webhooks\Observers;

use App\Models\ClientDetails;
use Modules\Webhooks\Jobs\SendWebhook;

class ClientDetailsObserver
{

    public function created(ClientDetails $clientDetails)
    {
        $data = $clientDetails->toArray();
        $user = $clientDetails->user->toArray();
        $data = array_merge($data, $user);

        SendWebhook::dispatch($data, 'Client', $clientDetails->company_id)
            ->delay(5)
            ->onQueue('default');
    }

}
