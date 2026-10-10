<?php

namespace App\Notifications;

use App\Models\Company;

/**
 * Result of a background "resync all user permissions" run. Database only —
 * the actor just clicked the button, so an email would be noise.
 */
class UserPermissionResyncCompleted extends BaseNotification
{
    /**
     * @param  array{synced: int, skipped_no_role: int, skipped_admin: int}|null  $counts
     */
    public function __construct(
        private int $companyId,
        private string $message,
        private ?array $counts = null
    ) {
        $this->company = Company::find($companyId);
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'user_permission_resync_completed',
            'title' => __('modules.permission.resyncAllUserPermissions'),
            'text' => $this->message,
            'activity_icon' => 'bell',
            'counts' => $this->counts,
        ];
    }
}
