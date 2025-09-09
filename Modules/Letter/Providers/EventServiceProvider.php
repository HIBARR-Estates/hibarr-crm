<?php

namespace Modules\Letter\Providers;

use App\Events\NewCompanyCreatedEvent;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\Letter\Entities\Letter;
use Modules\Letter\Entities\Template;
use Modules\Letter\Listeners\CompanyCreatedListener;
use Modules\Letter\Observers\LetterObserver;
use Modules\Letter\Observers\TemplateObserver;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
    ];

    protected $observers = [
        Letter::class => [LetterObserver::class],
        Template::class => [TemplateObserver::class],
    ];
}
