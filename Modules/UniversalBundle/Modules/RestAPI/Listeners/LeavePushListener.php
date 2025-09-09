<?php

namespace Modules\RestAPI\Listeners;

use App\Events\LeaveEvent;
use App\Models\User;
use Illuminate\Support\Str;

class LeavePushListener extends BasePushNotification
{

    public function handle(LeaveEvent $event)
    {
        $leave = $event->leave;

        if ($event->status == 'updated') {
            $role = $this->getUserRole($event->leave->user);
            $this->setMessage($this->leaveUpdatedMessage($leave, 'Leave Updated', $role));
            $this->sendNotification($event->leave->user);

            return true;
        }

        if ($event->status == 'statusUpdated') {

            if ($event->leave->status == 'approved') {
                $role = $this->getUserRole($event->leave->user);
                $this->setMessage($this->leaveApprovedMessage($leave, 'Leave Approved', $role));

            }
            else {
                $role = $this->getUserRole($event->leave->user);
                $this->setMessage($this->leaveRejectMessage($leave, 'Leave Reject', $role));
            }

            $this->sendNotification($event->leave->user);

            return true;
        }

        if ($event->status == 'created') {

            if (!is_null($event->multiDates)) {
                $role = $this->getUserRole($event->leave->user);
                $this->setMessage($this->leaveMultipleMessage('Leave Multiple', $role));
                $this->sendNotification($event->leave->user);

                foreach (User::allAdmins($event->leave->company->id) as $user) {
                    $role = $this->getUserRole($user);
                    $this->setMessage($this->leaveMultipleMessage('Leave Multiple', $role));
                    $this->sendNotification($user);
                }

                return true;
            }

            $role = $this->getUserRole($event->leave->user);
            $this->setMessage($this->leaveMessage($leave, 'Leave Single', $role));
            $this->sendNotification($event->leave->user);

            foreach (User::allAdmins($event->leave->company->id) as $user) {
                $role = $this->getUserRole($user);
                $this->setMessage($this->leaveMessage($leave, 'Leave Single', $role));
                $this->sendNotification($user);
            }

            return true;
        }
    }

    private function leaveUpdatedMessage($leave, $title, $role): array
    {
        $notificationData = [
            'title' => __('email.leaves.statusSubject'),
            'body' => __('app.date') . ': ' . $leave->leave_date->format('d M, Y') . ' ' .
                __('app.price') . ': ' . __('app.status') . ': ' . $leave->status,
            'sound' => 'default',
            'badge' => 1,
            'id' => $leave->id,
            'type' => Str::slug($title),
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);
    }

    private function leaveApprovedMessage($leave, $title, $role): array
    {

        $notificationData = [
            'title' => __('email.leaves.statusSubject'),
            'body' => __('email.leave.approve') . ':- ' .
                __('app.date') . ': ' . $leave->leave_date->format('d M, Y') . ' ' .
                __('app.status') . ': ' . $leave->status,
            'sound' => 'default',
            'badge' => 1,
            'id' => $leave->id,
            'type' => Str::slug($title),
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);
    }

    private function leaveRejectMessage($leave, $title, $role): array
    {

        $notificationData = [
            'title' => __('email.leaves.statusSubject'),
            'body' => __('email.leave.reject') . ':- ' .
                __('app.date') . ': ' . $leave->leave_date->format('d M, Y') . ' ' .
                __('app.status') . ': ' . $leave->status,
            'sound' => 'default',
            'badge' => 1,
            'id' => $leave->id,
            'type' => Str::slug($title),
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);
    }

    private function leaveMessage($leave, $title, $role): array
    {


        $notificationData = [
            'title' => __('email.leave.applied'),
            'body' => __('email.leave.applied') . ':- ' .
                __('app.date') . ': ' . $leave->leave_date->toDayDateTimeString() . ' ' .
                __('app.status') . ': ' . $leave->status,
            'sound' => 'default',
            'badge' => 1,
            'id' => $leave->id,
            'type' => Str::slug($title),
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);
    }

    private function leaveMultipleMessage($title, $role): array
    {


        $notificationData = [
            'title' => __('email.leave.applied'),
            'body' => __('email.leave.applied'),
            'sound' => 'default',
            'badge' => 1,
            'type' => Str::slug($title),
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);

    }

}
