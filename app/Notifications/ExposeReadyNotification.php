<?php

namespace App\Notifications;

use App\Models\ExposeJob;

class ExposeReadyNotification extends BaseNotification
{
    private ExposeJob $exposeJob;

    public function __construct(ExposeJob $exposeJob)
    {
        $this->exposeJob = $exposeJob;
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'id'           => $this->exposeJob->id,
            'type'         => 'expose_ready',
            'filename'     => $this->exposeJob->filename,
            'download_url' => $this->exposeJob->download_url,
            'entity_type'  => $this->exposeJob->entity_type,
            'entity_id'    => $this->exposeJob->entity_id,
        ];
    }
}
