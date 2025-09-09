<?php

namespace Modules\CyberSecurity\Listeners;

use Illuminate\Support\Facades\Notification;
use Modules\CyberSecurity\Entities\CyberSecurity;
use Modules\CyberSecurity\Notifications\LockoutEmailNotification;

class LockoutEmailListener
{

    public function handle($event): void
    {
        $cyberSecurity = CyberSecurity::first();

        if($cyberSecurity->email){
            Notification::route('mail', $cyberSecurity->email)->notify(new LockoutEmailNotification($event));
        }
    }

}
