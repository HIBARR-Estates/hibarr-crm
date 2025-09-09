<?php

namespace Modules\Sms\Listeners;

use App\Events\RemovalRequestAdminEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\RemovalRequestAdminNotification;

class RemovalRequestAdminListener
{
     */
    // phpcs:ignore
    public function handle(RemovalRequestAdminEvent $event)
    {
        $company = $event->removalRequest->company;
        try {
            Notification::send(User::allAdmins($company->id), new RemovalRequestAdminNotification($company));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
