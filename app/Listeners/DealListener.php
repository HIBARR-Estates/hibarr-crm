<?php

namespace App\Listeners;

use App\Events\DealEvent;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\DealStageUpdated;
use App\Notifications\LeadAgentAssigned;
use Illuminate\Notifications\Notification as NotificationInstance;
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
        $deal = Deal::with('leadAgent', 'leadAgent.user', 'company')->findOrFail($event->deal->id);

        if ($event->notificationName == 'LeadAgentAssigned') {
            $this->notifyFor($event->notifyUser, $deal, new LeadAgentAssigned($deal));
        }

        if ($event->notificationName == 'StageUpdated') {
            $this->notifyFor($event->notifyUser, $deal, new DealStageUpdated($deal));
        }
    }

    /**
     * Send notification to the appropriate user(s) based on notifyUser type.
     *
     * @param mixed $notifyUser The user(s) to notify (LeadAgent, Collection, User, or null)
     * @param Deal $deal The deal associated with the notification
     * @param NotificationInstance $notification The notification instance to send
     * @return void
     */
    private function notifyFor($notifyUser, Deal $deal, NotificationInstance $notification): void
    {
        $notification = BaseNotification::applySuppressionFromContainer($notification);

        if ($notifyUser instanceof LeadAgent) {
            // Notify the lead agent's user
            if ($notifyUser->user) {
                Notification::send($notifyUser->user, $notification);
            }
        } elseif ($notifyUser instanceof Collection) {
            // Notify a collection of users (watchers)
            $users = $notifyUser->filter(function ($item) {
                return $item instanceof User;
            });
            
            if ($users->isNotEmpty()) {
                Notification::send($users, $notification);
            }
        } elseif ($notifyUser instanceof User) {
            // Notify a single user
            Notification::send($notifyUser, $notification);
        } else {
            // Fallback: try to notify the deal's lead agent if available
            if ($deal->leadAgent && $deal->leadAgent->user) {
                Notification::send($deal->leadAgent->user, $notification);
            }
        }
    }

}
