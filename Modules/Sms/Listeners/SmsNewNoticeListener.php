<?php

namespace Modules\Sms\Listeners;

use App\Events\NewNoticeEvent;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewNoticeSms;
use Modules\Sms\Notifications\NoticeUpdate;

class SmsNewNoticeListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(NewNoticeEvent $event)
    {
        try {
            if (isset($event->action) && $event->action == 'update') {
                Notification::send($event->notifyUser, new NoticeUpdate($event->notice));
            }
            else {
                Notification::send($event->notifyUser, new NewNoticeSms($event->notice));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
