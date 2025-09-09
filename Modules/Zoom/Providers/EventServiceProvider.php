<?php

namespace Modules\Zoom\Providers;

use App\Events\NewCompanyCreatedEvent;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Modules\Zoom\Entities\ZoomCategory;
use Modules\Zoom\Entities\ZoomMeeting;
use Modules\Zoom\Entities\ZoomMeetingNote;
use Modules\Zoom\Events\CompanyUrlEvent;
use Modules\Zoom\Events\MeetingHostEvent;
use Modules\Zoom\Events\MeetingHostUpdateEvent;
use Modules\Zoom\Events\MeetingInviteEvent;
use Modules\Zoom\Events\MeetingReminderEvent;
use Modules\Zoom\Events\MeetingUpdateEvent;
use Modules\Zoom\Listeners\CompanyCreatedListener;
use Modules\Zoom\Listeners\HostUpdateListener;
use Modules\Zoom\Listeners\InviteListener;
use Modules\Zoom\Listeners\MeetingHostListener;
use Modules\Zoom\Listeners\MeetingInviteListener;
use Modules\Zoom\Listeners\MeetingReminderListener;
use Modules\Zoom\Listeners\MeetingUpdateListener;
use Modules\Zoom\Observers\CategoryObserver;
use Modules\Zoom\Observers\ZoomMeetingObserver;
use Modules\Zoom\Observers\ZoomNoteObserver;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event listener mappings for the application.
     *
     * @var array
     */
    protected $listen = [
        CompanyUrlEvent::class => [MeetingInviteListener::class],
        MeetingReminderEvent::class => [MeetingReminderListener::class],
        NewCompanyCreatedEvent::class => [CompanyCreatedListener::class],
        MeetingInviteEvent::class => [InviteListener::class],
        MeetingHostEvent::class => [MeetingHostListener::class],
        MeetingUpdateEvent::class => [MeetingUpdateListener::class],
        MeetingHostUpdateEvent::class => [HostUpdateListener::class],

    ];

    protected $observers = [
        ZoomMeeting::class => [ZoomMeetingObserver::class],
        ZoomCategory::class => [CategoryObserver::class],
        ZoomMeetingNote::class => [ZoomNoteObserver::class],

    ];
}
