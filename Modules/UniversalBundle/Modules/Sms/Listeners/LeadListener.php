<?php

namespace Modules\Sms\Listeners;

use App\Events\LeadEvent;
use App\Models\Lead;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\LeadAgentAssigned;

class LeadListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(LeadEvent $event)
    {
        try {
            if ($event->notificationName == 'LeadAgentAssigned') {
                $lead = Lead::with('leadAgent', 'leadAgent.user')->find($event->lead->id);
                Notification::send($lead->leadAgent->user, new LeadAgentAssigned($lead));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
