<?php

namespace Modules\Biolinks\Providers;

use App\Events\NewCompanyCreatedEvent;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\Biolinks\Events\PhoneCollectionEmailEvent;
use Modules\Biolinks\Listeners\CompanyCreatedListener;
use Modules\Biolinks\Listeners\PhoneCollectionEmailListener;

class EventServiceProvider extends ServiceProvider
{

    protected $listen = [
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
        PhoneCollectionEmailEvent::class => [PhoneCollectionEmailListener::class],
    ];

    protected $observers = [

    ];

}
