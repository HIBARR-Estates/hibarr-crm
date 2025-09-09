<?php

namespace Modules\Sms\Listeners;

use App\Events\NewProjectEvent;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewProject;

class NewProjectListener
{
    public function handle(NewProjectEvent $event)
    {
        if (($event->project->client_id != null)) {
            $clientId = $event->project->client_id;
            // Notify client
            $notifyUser = User::withoutGlobalScope(ActiveScope::class)->findOrFail($clientId);

            try {
                if ($notifyUser) {
                    Notification::send($notifyUser, new NewProject($event->project));
                }
            } catch (\Exception $e) { // @codingStandardsIgnoreLine
            }
        }
    }

}
