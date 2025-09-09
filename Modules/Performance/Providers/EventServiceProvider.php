<?php

namespace Modules\Performance\Providers;

use App\Events\NewCompanyCreatedEvent;
use Modules\Performance\Entities\CheckIn;
use Modules\Performance\Entities\Objective;
use Modules\Performance\Observers\CheckInObserver;
use Modules\Performance\Observers\ObjectiveObserver;
use Modules\Performance\Events\ObjectiveCreatedEvent;
use Modules\Performance\Listeners\CompanyCreatedListener;
use Modules\Performance\Listeners\ObjectiveCreatedListener;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\Performance\Entities\KeyResults;
use Modules\Performance\Events\CheckInReminderEvent;
use Modules\Performance\Events\MeetingInviteEvent;
use Modules\Performance\Events\MeetingReminderEvent;
use Modules\Performance\Listeners\CheckInReminderListener;
use Modules\Performance\Listeners\MeetingInviteListener;
use Modules\Performance\Listeners\MeetingReminderListener;
use Modules\Performance\Observers\KeyResultsObserver;

class EventServiceProvider extends ServiceProvider
{

    protected $listen = [
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
        ObjectiveCreatedEvent::class => [ObjectiveCreatedListener::class],
        MeetingInviteEvent::class => [MeetingInviteListener::class],
        MeetingReminderEvent::class => [MeetingReminderListener::class],
        CheckInReminderEvent::class => [CheckInReminderListener::class],
    ];

    protected $observers = [
        Objective::class => [ObjectiveObserver::class],
        CheckIn::class => [CheckInObserver::class],
        KeyResults::class => [KeyResultsObserver::class],

    ];

}
