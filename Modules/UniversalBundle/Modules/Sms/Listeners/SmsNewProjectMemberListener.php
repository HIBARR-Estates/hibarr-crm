<?php

namespace Modules\Sms\Listeners;

use App\Events\NewProjectMemberEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewProjectMemberSms;

class SmsNewProjectMemberListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewProjectMemberEvent $event)
    {
        try {
            if (isset($event->projectMember->user->mobile) && ! is_null($event->projectMember->user->mobile)) {
                Notification::send($event->projectMember->user, new NewProjectMemberSms($event->projectMember->project));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
