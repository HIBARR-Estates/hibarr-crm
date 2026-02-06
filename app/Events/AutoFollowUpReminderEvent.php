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
    public $targetUserId;

    public function __construct(DealFollowUp $followup, $subject, $reminder = null, ?int $targetUserId = null)
    {
        $this->followup = $followup;
        $this->subject = $subject;
        $this->reminder = $reminder; // Optional reminder details for multiple reminders
        $this->targetUserId = $targetUserId; // Specific user to send notification to
    }

}
