<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;

class BeamsPushChannel
{
    /**
     * @param  mixed  $notifiable
     */
    public function send($notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toBeamsPush')) {
            return;
        }

        $payload = $notification->toBeamsPush($notifiable);
        if ($payload === null) {
            return;
        }

        if (push_setting()->beams_push_status !== 'active' || ! isset($notifiable->id)) {
            return;
        }

        $pushNotification = new \App\Http\Controllers\DashboardController;
        $pushNotification->sendPushNotifications(
            [[$notifiable->id]],
            (string) ($payload['title'] ?? ''),
            (string) ($payload['body'] ?? ''),
        );
    }
}
