<?php

namespace App\Services;

use App\Helper\Reply;
use App\Models\User;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Service class for managing user notifications.
 * 
 * Handles notification retrieval, marking as read, deletion,
 * and bulk operations for the notification system.
 */
class NotificationService
{
    /**
     * Get paginated notifications for a user.
     *
     * @param User $user The user to get notifications for
     * @param array $filters Optional filters ['status' => 'all|unread|read', 'type' => string]
     * @param int $perPage Number of notifications per page
     * @return LengthAwarePaginator
     */
    public function getNotifications(User $user, array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = $user->notifications();

        // Filter by read status
        if (isset($filters['status'])) {
            if ($filters['status'] === 'unread') {
                $query->whereNull('read_at');
            } elseif ($filters['status'] === 'read') {
                $query->whereNotNull('read_at');
            }
        }

        // Filter by notification type
        if (isset($filters['type']) && !empty($filters['type'])) {
            $query->where('type', 'like', '%' . $filters['type'] . '%');
        }

        // Search in notification data
        if (isset($filters['search']) && !empty($filters['search'])) {
            $query->where('data', 'like', '%' . $filters['search'] . '%');
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Get unread notifications count for a user.
     *
     * @param User $user
     * @return int
     */
    public function getUnreadCount(User $user): int
    {
        return $user->unreadNotifications()->count();
    }

    /**
     * Get recent unread notifications for dropdown preview.
     *
     * @param User $user
     * @param int $limit
     * @return Collection
     */
    public function getRecentUnread(User $user, int $limit = 6): Collection
    {
        return $user->unreadNotifications()
            ->orderBy('created_at', 'desc')
            ->take($limit)
            ->get();
    }

    /**
     * Format notification for API response.
     *
     * @param DatabaseNotification $notification
     * @return array
     */
    public function formatNotification(DatabaseNotification $notification): array
    {
        $data = $notification->data;
        $type = class_basename($notification->type);
        $typeSlug = Str::snake($type);

        return [
            'id' => $notification->id,
            'type' => $type,
            'type_slug' => $typeSlug,
            'title' => $this->getNotificationTitle($typeSlug, $data),
            'text' => $data['heading'] ?? $data['text'] ?? $data['message'] ?? '',
            'data' => $data,
            'link' => $this->getNotificationLink($typeSlug, $data),
            'icon' => $this->getNotificationIcon($typeSlug),
            'is_read' => !is_null($notification->read_at),
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at->toIso8601String(),
            'time_ago' => $notification->created_at->diffForHumans(),
        ];
    }

    /**
     * Format a collection of notifications.
     *
     * @param Collection $notifications
     * @return array
     */
    public function formatNotifications($notifications): array
    {
        return $notifications->map(fn($n) => $this->formatNotification($n))->toArray();
    }

    /**
     * Mark a single notification as read.
     *
     * @param User $user
     * @param string $notificationId
     * @return bool
     */
    public function markAsRead(User $user, string $notificationId): bool
    {
        $notification = $user->notifications()->where('id', $notificationId)->first();

        if (!$notification) {
            return false;
        }

        $notification->markAsRead();
        return true;
    }

    /**
     * Mark all unread notifications as read for a user.
     *
     * @param User $user
     * @return int Number of notifications marked as read
     */
    public function markAllAsRead(User $user): int
    {
        $count = $user->unreadNotifications()->count();
        $user->unreadNotifications->markAsRead();
        return $count;
    }

    /**
     * Mark multiple notifications as read.
     *
     * @param User $user
     * @param array $notificationIds
     * @return int Number of notifications marked as read
     */
    public function markMultipleAsRead(User $user, array $notificationIds): int
    {
        $notifications = $user->notifications()
            ->whereIn('id', $notificationIds)
            ->whereNull('read_at')
            ->get();

        $notifications->markAsRead();
        
        return $notifications->count();
    }

    /**
     * Delete a single notification.
     *
     * @param User $user
     * @param string $notificationId
     * @return bool
     */
    public function delete(User $user, string $notificationId): bool
    {
        $deleted = $user->notifications()
            ->where('id', $notificationId)
            ->delete();

        return $deleted > 0;
    }

    /**
     * Delete multiple notifications.
     *
     * @param User $user
     * @param array $notificationIds
     * @return int Number of notifications deleted
     */
    public function deleteMultiple(User $user, array $notificationIds): int
    {
        return $user->notifications()
            ->whereIn('id', $notificationIds)
            ->delete();
    }

    /**
     * Delete all read notifications for a user.
     *
     * @param User $user
     * @return int Number of notifications deleted
     */
    public function deleteAllRead(User $user): int
    {
        return $user->notifications()
            ->whereNotNull('read_at')
            ->delete();
    }

    /**
     * Get notification title based on type.
     *
     * @param string $typeSlug
     * @param array $data
     * @return string
     */
    protected function getNotificationTitle(string $typeSlug, array $data): string
    {
        $titles = [
            'new_task' => __('email.newTask.subject'),
            'new_notice' => __('email.newNotice.subject'),
            'task_completed' => __('email.taskComplete.subject'),
            'task_updated' => __('email.taskUpdate.subject'),
            'task_comment' => __('email.taskComment.subject'),
            'new_chat' => __('email.newChat.subject'),
            'new_ticket' => __('email.newTicket.subject'),
            'new_ticket_reply' => __('email.newTicketReply.subject'),
            'leave_application' => __('email.leave.applied'),
            'leave_status_approve' => __('email.leave.approve'),
            'leave_status_reject' => __('email.leave.reject'),
            'new_project_member' => __('email.newProjectMember.subject'),
            'new_expense_admin' => __('email.newExpense.subject'),
            'new_expense_member' => __('email.newExpense.subject'),
            'invoice_payment_received' => __('email.invoicePaymentReceived.subject'),
            'new_lead_created' => __('email.newLead.subject'),
            'lead_agent_assigned' => __('email.leadAgentAssigned.subject'),
            'deal_stage_updated' => __('email.dealStageUpdate.subject'),
            'event_invite' => __('email.eventInvite.subject'),
            'event_reminder' => __('email.eventReminder.subject'),
            'new_appreciation' => __('email.newAppreciation.subject'),
            'birthday_reminder' => __('email.birthdayReminder.subject'),
            'contract_signed' => __('email.contractSigned.subject'),
            'new_discussion' => __('email.discussion.subject'),
            'new_discussion_reply' => __('email.discussionReply.subject'),
            'shift_scheduled' => __('email.shiftScheduled.subject'),
            'shift_change_status' => __('email.shiftChangeStatus.subject'),
            'promotion_added' => __('email.promotionAdded.subject'),
        ];

        return $titles[$typeSlug] ?? ($data['title'] ?? ucfirst(str_replace('_', ' ', $typeSlug)));
    }

    /**
     * Get notification link based on type.
     *
     * @param string $typeSlug
     * @param array $data
     * @return string|null
     */
    protected function getNotificationLink(string $typeSlug, array $data): ?string
    {
        $id = $data['id'] ?? null;

        if (!$id) {
            return null;
        }

        $routes = [
            'new_task' => 'tasks.show',
            'task_completed' => 'tasks.show',
            'task_updated' => 'tasks.show',
            'task_comment' => 'tasks.show',
            'task_status_updated' => 'tasks.show',
            'new_notice' => 'notices.show',
            'notice_update' => 'notices.show',
            'new_ticket' => 'tickets.show',
            'new_ticket_reply' => 'tickets.show',
            'new_lead_created' => 'deals.show',
            'lead_agent_assigned' => 'deals.show',
            'deal_stage_updated' => 'deals.show',
            'new_project_member' => 'projects.show',
            'new_project_status' => 'projects.show',
            'new_expense_admin' => 'expenses.show',
            'new_expense_member' => 'expenses.show',
            'new_expense_status' => 'expenses.show',
            'invoice_payment_received' => 'invoices.show',
            'leave_application' => 'leaves.show',
            'leave_status_approve' => 'leaves.show',
            'leave_status_reject' => 'leaves.show',
            'new_leave_request' => 'leaves.show',
            'event_invite' => 'events.show',
            'event_reminder' => 'events.show',
            'new_appreciation' => 'appreciations.show',
            'contract_signed' => 'contracts.show',
            'new_discussion' => 'discussion.show',
            'new_discussion_reply' => 'discussion.show',
            'shift_scheduled' => 'attendances.index',
            'promotion_added' => 'employees.show',
        ];

        if (isset($routes[$typeSlug])) {
            try {
                return route($routes[$typeSlug], $id);
            } catch (\Exception $e) {
                return null;
            }
        }

        return null;
    }

    /**
     * Get notification icon based on type.
     *
     * @param string $typeSlug
     * @return string
     */
    protected function getNotificationIcon(string $typeSlug): string
    {
        $icons = [
            'new_task' => 'task',
            'task_completed' => 'task-completed',
            'task_updated' => 'task',
            'task_comment' => 'comment',
            'task_status_updated' => 'task',
            'new_notice' => 'notice',
            'notice_update' => 'notice',
            'new_chat' => 'chat',
            'new_mention_chat' => 'chat',
            'new_ticket' => 'ticket',
            'new_ticket_reply' => 'ticket',
            'new_lead_created' => 'lead',
            'lead_agent_assigned' => 'lead',
            'deal_stage_updated' => 'deal',
            'new_project_member' => 'project',
            'new_project_status' => 'project',
            'new_expense_admin' => 'expense',
            'new_expense_member' => 'expense',
            'new_expense_status' => 'expense',
            'invoice_payment_received' => 'invoice',
            'leave_application' => 'leave',
            'leave_status_approve' => 'leave-approved',
            'leave_status_reject' => 'leave-rejected',
            'new_leave_request' => 'leave',
            'event_invite' => 'event',
            'event_reminder' => 'event',
            'new_appreciation' => 'appreciation',
            'birthday_reminder' => 'birthday',
            'contract_signed' => 'contract',
            'new_discussion' => 'discussion',
            'new_discussion_reply' => 'discussion',
            'shift_scheduled' => 'shift',
            'shift_change_status' => 'shift',
            'promotion_added' => 'promotion',
        ];

        return $icons[$typeSlug] ?? 'bell';
    }

    /**
     * Get all distinct notification types for a user.
     *
     * @param User $user
     * @return array
     */
    public function getNotificationTypes(User $user): array
    {
        return $user->notifications()
            ->select('type')
            ->distinct()
            ->pluck('type')
            ->map(function ($type) {
                $basename = class_basename($type);
                return [
                    'value' => $basename,
                    'label' => ucfirst(str_replace('_', ' ', Str::snake($basename))),
                ];
            })
            ->toArray();
    }
}
