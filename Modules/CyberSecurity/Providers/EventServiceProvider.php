<?php

namespace Modules\CyberSecurity\Providers;

use App\Events\UserLoginEvent;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\CyberSecurity\Events\LockoutEmailEvent;
use Modules\CyberSecurity\Listeners\DifferentIpListener;
use Modules\CyberSecurity\Listeners\LockoutEmailListener;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        LockoutEmailEvent::class => [
            LockoutEmailListener::class,
        ],
        UserLoginEvent::class => [
            DifferentIpListener::class,
        ],
    ];

    protected $observers = [

    ];
}
