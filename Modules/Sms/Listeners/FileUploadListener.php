<?php

namespace Modules\Sms\Listeners;

use App\Events\FileUploadEvent;
use App\Models\Project;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\FileUpload;

class FileUploadListener
{
    /**
     * Handle the event.
     *
     * @return void
     */
    public function handle(FileUploadEvent $event)
    {
        try {
            $project = Project::findOrFail($event->fileUpload->project_id);
            Notification::send($project->projectMembers, new FileUpload($event->fileUpload));

            if (($event->fileUpload->project->client_id != null)) {
                // Notify client
                $notifyUser = User::withoutGlobalScope(ActiveScope::class)->findOrFail($event->fileUpload->project->client_id);

                if ($notifyUser) {
                    Notification::send($notifyUser, new FileUpload($event->fileUpload));
                }
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
