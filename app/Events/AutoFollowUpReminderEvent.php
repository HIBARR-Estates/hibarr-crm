<?php

namespace App\Events;

use App\Models\DealFollowUp;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AutoFollowUpReminderEvent
{

    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $followup;
    public $subject;
    public $reminder;

    public function __construct(DealFollowUp $followup, $subject, $reminder = null)
    {
        $this->followup = $followup;
        $this->subject = $subject;
        $this->reminder = $reminder; // Optional reminder details for multiple reminders
    }

}
