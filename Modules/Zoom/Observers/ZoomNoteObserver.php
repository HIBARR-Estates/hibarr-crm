<?php

namespace Modules\Zoom\Observers;

use Modules\Zoom\Entities\ZoomMeetingNote;

class ZoomNoteObserver
{
    public function creating(ZoomMeetingNote $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }
    }
}
