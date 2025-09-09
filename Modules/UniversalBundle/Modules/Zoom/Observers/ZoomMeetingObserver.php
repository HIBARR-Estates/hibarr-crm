<?php

namespace Modules\Zoom\Observers;

use Modules\Zoom\Entities\ZoomMeeting;

class ZoomMeetingObserver
{
    public function saving(ZoomMeeting $event)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $event->last_updated_by = user()->id;
        }
    }

    public function creating(ZoomMeeting $event)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $event->added_by = user()->id;
        }

        if (company()) {
            $event->company_id = company()->id;
        }
    }
}
