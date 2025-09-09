<?php

namespace Modules\Performance\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Modules\Performance\Entities\Meeting;

class MeetingReminderEvent
{

    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $meeting;
    public $meetingBy;

    public function __construct(Meeting $meeting, $meetingBy)
    {
        $this->meeting = $meeting;
        $this->meetingBy = $meetingBy;
    }

}
