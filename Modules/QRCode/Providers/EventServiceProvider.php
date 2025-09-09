<?php

namespace Modules\QRCode\Providers;

use App\Events\NewCompanyCreatedEvent;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\QRCode\Listeners\CompanyCreatedListener;

class EventServiceProvider extends ServiceProvider
{

    protected $listen = [
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
    ];

}
