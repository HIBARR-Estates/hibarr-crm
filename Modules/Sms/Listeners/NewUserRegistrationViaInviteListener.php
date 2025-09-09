<?php

namespace Modules\Sms\Listeners;

use App\Events\NewUserRegistrationViaInviteEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewUserViaLink;

class NewUserRegistrationViaInviteListener
{
    public function handle(NewUserRegistrationViaInviteEvent $event)
    {
        try {
            Notification::send($event->user, new NewUserViaLink($event->new_user, $event->user));
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
