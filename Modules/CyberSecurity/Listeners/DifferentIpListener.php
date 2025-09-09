<?php

namespace Modules\CyberSecurity\Listeners;

use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Modules\CyberSecurity\Entities\CyberSecurity;
use Modules\CyberSecurity\Notifications\DifferentIpNotification;

class DifferentIpListener
{

    public function handle($event): void
    {
        RateLimiter::clear('cybersecurity:login' . $event->ip);
        RateLimiter::clear('cybersecurity:loginLockout' . $event->ip);

        if (isWorksuite()) {
            $cyberSecurity = CyberSecurity::first();

            if ($cyberSecurity->email && $cyberSecurity->ip != $event->ip && $cyberSecurity->ip_check == 1) {
                Notification::route('mail', $cyberSecurity->email)->notify(new DifferentIpNotification($event));
            }
        }
    }

}
