<?php

namespace App\Listeners;

use App\Events\LeadEvent;
use App\Models\User;
use App\Notifications\NewLeadCreated;
use Illuminate\Support\Facades\Notification;

class LeadListener
{

    /**
     * Handle the event.
     *
     * @param LeadEvent $event
     * @return void
     */

    public function handle(LeadEvent $event)
    {
        $admins = User::allAdmins($event->leadContact->company->id);
        $actorId = user()?->id;
        if ($actorId !== null) {
            $admins = $admins->reject(fn (User $admin) => (int) $admin->id === (int) $actorId);
        }

        if (session('is_imported') == false && $admins->isNotEmpty()) {
            Notification::send($admins, new NewLeadCreated($event->leadContact));
        }

    }

}
