<?php

namespace Modules\Sms\Listeners;

use App\Events\RemovalRequestAdminLeadEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\RemovalRequestAdminNotification;

class RemovalRequestAdminLeadListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    // phpcs:ignore
    public function handle(RemovalRequestAdminLeadEvent $event)
    {
        $company = $event->removalRequestLead->company;
        try {
            Notification::send(User::allAdmins($company->id), new RemovalRequestAdminNotification($company));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
