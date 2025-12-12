<?php

namespace App\Listeners;

use App\Events\DealEvent;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\User;
use App\Notifications\DealStageUpdated;
use App\Notifications\LeadAgentAssigned;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class DealListener
{

    /**
     * Handle the event.
     *
     * @param DealEvent $event
     * @return void
     */

    public function handle(DealEvent $event)
    {
        $deal = Deal::with('leadAgent', 'leadAgent.user')->findOrFail($event->deal->id);

        if ($event->notificationName == 'LeadAgentAssigned') {
            // Handle different types of notifyUser
            if ($event->notifyUser instanceof LeadAgent) {
                // Notify the lead agent's user
                if ($event->notifyUser->user) {
                    Notification::send($event->notifyUser->user, new LeadAgentAssigned($deal));
                }
            } elseif ($event->notifyUser instanceof Collection) {
                // Notify a collection of users (watchers)
                $users = $event->notifyUser->filter(function ($item) {
                    return $item instanceof User;
                });
                
                if ($users->isNotEmpty()) {
                    Notification::send($users, new LeadAgentAssigned($deal));
                }
            } elseif ($event->notifyUser instanceof User) {
                // Notify a single user
                Notification::send($event->notifyUser, new LeadAgentAssigned($deal));
            } else {
                // Fallback: try to notify the deal's lead agent if available
                if ($deal->leadAgent && $deal->leadAgent->user) {
                    Notification::send($deal->leadAgent->user, new LeadAgentAssigned($deal));
                }
            }
        }

        if ($event->notificationName == 'StageUpdated') {
            // Handle different types of notifyUser
            if ($event->notifyUser instanceof LeadAgent) {
                // Notify the lead agent's user
                if ($event->notifyUser->user) {
                    Notification::send($event->notifyUser->user, new DealStageUpdated($deal));
                }
            } elseif ($event->notifyUser instanceof Collection) {
                // Notify a collection of users (watchers)
                $users = $event->notifyUser->filter(function ($item) {
                    return $item instanceof User;
                });
                
                if ($users->isNotEmpty()) {
                    Notification::send($users, new DealStageUpdated($deal));
                }
            } elseif ($event->notifyUser instanceof User) {
                // Notify a single user
                Notification::send($event->notifyUser, new DealStageUpdated($deal));
            } else {
                // Fallback: try to notify the deal's lead agent if available
                if ($deal->leadAgent && $deal->leadAgent->user) {
                    Notification::send($deal->leadAgent->user, new DealStageUpdated($deal));
                }
            }
        }
    }

}
