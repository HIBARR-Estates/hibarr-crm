<?php

namespace App\Services;

use App\Models\Task;
use App\Models\User;
use App\Support\EntityActivityNotificationUrl;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

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
     * @param  User  $user  The user to get notifications for
     * @param  array  $filters  Optional filters ['status' => 'all|unread|read', 'type' => string]
     * @param  int  $perPage  Number of notifications per page
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
        if (isset($filters['type']) && ! empty($filters['type'])) {
            $query->where('type', 'like', '%'.$filters['type'].'%');
        }

        // Search in notification data
        if (isset($filters['search']) && ! empty($filters['search'])) {
            $query->where('data', 'like', '%'.$filters['search'].'%');
        }

        return $query->orderBy('created_at', 'desc')->paginate($perPage);
    }

    /**
     * Get unread notifications count for a user.
     */
    public function getUnreadCount(User $user): int
    {
        return $user->unreadNotifications()->count();
    }

    /**
     * Get recent unread notifications for dropdown preview.
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
     */
    public function formatNotification(DatabaseNotification $notification): array
    {
        $data = is_array($notification->data) ? $notification->data : [];
        $type = class_basename($notification->type);
        $typeSlug = Str::snake($type);
        $data = $this->enrichTaskNotificationData($data, $typeSlug);
        $title = $data['title'] ?? $this->getNotificationTitle($typeSlug, $data);

        return [
            'id' => $notification->id,
            'type' => $type,
            'type_slug' => $typeSlug,
            'title' => $title,
            'text' => $data['text'] ?? $data['message'] ?? $data['heading'] ?? $this->getNotificationFallbackText($data, $title),
            'data' => $data,
            'link' => $this->getNotificationLink($typeSlug, $data),
            'icon' => $this->getNotificationIcon($typeSlug),
            'is_read' => ! is_null($notification->read_at),
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at->toIso8601String(),
            'time_ago' => $notification->created_at->diffForHumans(),
        ];
    }

    /**
     * Format a collection of notifications.
     *
     * @param  Collection  $notifications
     */
    public function formatNotifications($notifications): array
    {
        return $notifications->map(fn ($n) => $this->formatNotification($n))->toArray();
    }

    /**
     * Mark a single notification as read.
     */
    public function markAsRead(User $user, string $notificationId): bool
    {
        $notification = $user->notifications()->where('id', $notificationId)->first();

        if (! $notification) {
            return false;
        }

        $notification->markAsRead();

        return true;
    }

    /**
     * Mark all unread notifications as read for a user.
     *
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
     */
    protected function getNotificationTitle(string $typeSlug, array $data): string
    {
        $titles = [
            'new_task' => __('email.newTask.subject'),
            'new_notice' => __('email.newNotice.subject'),
            'task_completed' => __('email.taskComplete.subject'),
            'task_lifecycle_created_notification' => __('email.newTask.subject'),
            'task_lifecycle_updated_notification' => __('email.taskUpdate.subject'),
            'task_lifecycle_due_notification' => __('email.taskLifecycle.due.subject'),
            'task_lifecycle_completed_notification' => __('email.taskComplete.subject'),
            'task_deleted' => __('email.taskDeleted.subject'),
            'task_rejected' => __('email.taskRejected.subject'),
            'task_overdue' => __('email.taskOverdue.subject'),
            'task_priority_updated' => __('email.taskPriorityUpdated.subject'),
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
            'lead_agent_assigned' => match ($data['assignment_role'] ?? 'deal_agent') {
                'deal_watcher' => __('email.dealWatcherAssigned.subject'),
                'new_deal' => __('email.newDealAwaitingAgent.subject'),
                default => __('email.dealAgentAssigned.subject'),
            },
            'deal_stage_updated' => __('email.dealStageUpdate.subject'),
            'event_invite' => __('email.eventInvite.subject'),
            'event_reminder' => __('email.eventReminder.subject'),
            'new_appreciation' => __('email.newAppreciation.subject'),
            'birthday_reminder' => __('email.BirthdayReminder.subject'),
            'contract_signed' => __('email.contractSigned.subject'),
            'new_discussion' => __('email.discussion.subject'),
            'new_discussion_reply' => __('email.discussionReply.subject'),
            'shift_scheduled' => __('email.shiftScheduled.subject'),
            'shift_change_status' => __('email.shiftChangeStatus.subject'),
            'promotion_added' => __('email.promotionAdded.subject'),
            'lead_deleted' => __('email.leadDeleted.subject'),
            'lead_follow_up_overdue' => __('email.leadFollowUpOverdue.subject'),
            'deal_deleted' => __('email.dealDeleted.subject'),
            'deal_close_date_approaching' => __('email.dealCloseDateApproaching.subject'),
            'property_activity_notification' => __('email.propertyActivity.subject'),
            'expose_ready_notification' => __('email.exposeReady.subject'),
        ];

        return $titles[$typeSlug] ?? ($data['title'] ?? $data['activity_label'] ?? ucfirst(str_replace('_', ' ', $typeSlug)));
    }

    /**
     * Build a readable fallback sentence for notification classes that don't
     * ship an explicit `title`/`text`/`message`/`heading` — avoids surfacing
     * a bare id, a raw model dump, or an empty body in the notification island.
     */
    protected function getNotificationFallbackText(array $data, string $title): string
    {
        $subjectKeys = ['name', 'subject', 'project_name', 'event_name', 'item_name', 'ticket_subject'];

        foreach ($subjectKeys as $key) {
            if (! empty($data[$key]) && is_string($data[$key])) {
                return trim($title).': '.$data[$key];
            }
        }

        return $title;
    }

    /**
     * Attach task + linked deal/lead ids for in-app quick actions.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function enrichTaskNotificationData(array $data, string $typeSlug): array
    {
        $icon = $this->getNotificationIcon($typeSlug);
        $isTask = in_array($icon, ['task', 'task-completed'], true)
            || ($data['entity_type'] ?? null) === 'task';

        if (! $isTask) {
            return $data;
        }

        $taskId = $data['task_id'] ?? $data['id'] ?? null;
        if (! $taskId) {
            return $data;
        }

        $data['task_id'] = (int) $taskId;

        if (empty($data['action_url'])) {
            try {
                $data['action_url'] = route('tasks.show', $taskId);
            } catch (\Exception $e) {
                // Route unavailable in this context.
            }
        }

        if (! empty($data['deal_id']) && ! empty($data['lead_id'])) {
            return $data;
        }

        $task = Task::query()
            ->with(['deals:id', 'leads:id'])
            ->find($taskId);

        if ($task === null) {
            return $data;
        }

        if (empty($data['deal_id'])) {
            $deal = $task->deals->first();
            if ($deal !== null) {
                $data['deal_id'] = $deal->id;
            }
        }

        if (empty($data['lead_id'])) {
            $lead = $task->leads->first();
            if ($lead !== null) {
                $data['lead_id'] = $lead->id;
            }
        }

        return $data;
    }

    /**
     * Get notification link based on type.
     */
    protected function getNotificationLink(string $typeSlug, array $data): ?string
    {
        // Check for explicit action_url in notification data first
        if (! empty($data['action_url'])) {
            return $data['action_url'];
        }

        if (! empty($data['download_url']) && $typeSlug === 'expose_ready_notification') {
            return $data['download_url'];
        }

        $routes = $this->notificationLinkRoutes();

        // Resolve the entity ID — task alerts must link to the task, not a related deal.
        $icon = $this->getNotificationIcon($typeSlug);
        if (in_array($icon, ['task', 'task-completed'], true) || ($data['entity_type'] ?? null) === 'task') {
            $id = $data['task_id'] ?? $data['id'] ?? null;
        } elseif ($typeSlug === 'new_discussion_mention') {
            $id = $data['id'] ?? null;
        } elseif ($typeSlug === 'mention_ticket_agent') {
            $id = $data['ticket_number'] ?? null;
        } else {
            $id = $this->resolveNotificationEntityId($typeSlug, $data, $routes);
        }

        if (! $id && ! in_array($typeSlug, ['task_deleted', 'lead_deleted', 'deal_deleted'], true)) {
            return null;
        }

        if (isset($routes[$typeSlug])) {
            try {
                if (in_array($typeSlug, ['task_deleted', 'lead_deleted', 'deal_deleted'], true)) {
                    return route($routes[$typeSlug]);
                }

                $url = route($routes[$typeSlug], $id);

                if (in_array($typeSlug, ['deal_activity_notification', 'lead_activity_notification'], true)) {
                    $url = EntityActivityNotificationUrl::appendTabIfMissing(
                        $url,
                        is_string($data['activity_type'] ?? null) ? $data['activity_type'] : null,
                    );
                }

                if ($typeSlug === 'lead_follow_up_overdue' && ! str_contains($url, 'tab=')) {
                    $url .= (str_contains($url, '?') ? '&' : '?').'tab=meetings';
                }

                return $url;
            } catch (\Exception $e) {
                return null;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, string>  $routes
     */
    protected function resolveNotificationEntityId(string $typeSlug, array $data, array $routes): mixed
    {
        $routeName = $routes[$typeSlug] ?? null;

        if ($routeName === null) {
            return $data['property_id'] ?? $data['deal_id'] ?? $data['lead_id'] ?? $data['task_id'] ?? $data['project_id'] ?? $data['id'] ?? null;
        }

        if (str_starts_with($routeName, 'properties.')) {
            return $data['property_id'] ?? $data['id'] ?? null;
        }

        if (str_starts_with($routeName, 'deals.')) {
            return $data['deal_id'] ?? $data['id'] ?? null;
        }

        if (str_starts_with($routeName, 'lead-contact.')) {
            return $data['lead_id'] ?? $data['id'] ?? null;
        }

        if (str_starts_with($routeName, 'tasks.')) {
            return $data['task_id'] ?? $data['id'] ?? null;
        }

        if (str_starts_with($routeName, 'projects.')) {
            return $data['project_id'] ?? $data['id'] ?? null;
        }

        return $data['id'] ?? null;
    }

    /**
     * @return array<string, string>
     */
    protected function notificationLinkRoutes(): array
    {
        return [
            'new_task' => 'tasks.show',
            'task_completed' => 'tasks.show',
            'task_completed_client' => 'tasks.show',
            'task_updated' => 'tasks.show',
            'task_updated_client' => 'tasks.show',
            'task_comment' => 'tasks.show',
            'task_comment_admin' => 'tasks.show',
            'task_comment_client' => 'tasks.show',
            'task_comment_mention' => 'tasks.show',
            'task_status_updated' => 'tasks.show',
            'task_note' => 'tasks.show',
            'task_note_client' => 'tasks.show',
            'task_note_mention' => 'tasks.show',
            'task_mention' => 'tasks.show',
            'task_reminder' => 'tasks.show',
            'task_lifecycle_created_notification' => 'tasks.show',
            'task_lifecycle_updated_notification' => 'tasks.show',
            'task_lifecycle_due_notification' => 'tasks.show',
            'task_lifecycle_completed_notification' => 'tasks.show',
            'task_approval' => 'tasks.show',
            'auto_task_reminder' => 'tasks.show',
            'new_client_task' => 'tasks.show',
            'sub_task_created' => 'tasks.show',
            'sub_task_completed' => 'tasks.show',
            'sub_task_assignee_added' => 'tasks.show',
            'task_deleted' => 'tasks.index',
            'task_rejected' => 'tasks.show',
            'task_overdue' => 'tasks.show',
            'task_priority_updated' => 'tasks.show',
            'new_notice' => 'notices.show',
            'notice_update' => 'notices.show',
            'new_ticket' => 'tickets.show',
            'new_ticket_reply' => 'tickets.show',
            'new_ticket_requester' => 'tickets.show',
            'new_ticket_note' => 'tickets.show',
            'ticket_agent' => 'tickets.show',
            'mention_ticket_agent' => 'tickets.show',
            'new_lead_created' => 'deals.show',
            'lead_owner_assigned' => 'lead-contact.show',
            'lead_agent_assigned' => 'deals.show',
            'deal_stage_updated' => 'deals.show',
            'deal_activity_notification' => 'deals.show',
            'auto_follow_up_reminder' => 'deals.show',
            'new_communication_activity' => 'deals.show',
            'lead_imported' => 'deals.show',
            'lead_deleted' => 'lead-contact.index',
            'lead_activity_notification' => 'lead-contact.show',
            'lead_follow_up_overdue' => 'deals.show',
            'deal_deleted' => 'deals.index',
            'deal_close_date_approaching' => 'deals.show',
            'property_activity_notification' => 'properties.show',
            'expose_ready_notification' => 'properties.show',
            'availability_requested' => 'properties.show',
            'availability_response' => 'properties.show',
            'availability_escalation' => 'properties.show',
            'availability_escalation_reminder' => 'properties.show',
            'edit_access_requested' => 'properties.show',
            'edit_access_reviewed' => 'properties.show',
            'property_access_request' => 'properties.show',
            'publish_request_submitted' => 'properties.show',
            'publish_request_reviewed' => 'properties.show',
            'new_project' => 'projects.show',
            'new_project_member' => 'projects.show',
            'new_project_status' => 'projects.show',
            'new_project_note' => 'projects.show',
            'project_reminder' => 'projects.show',
            'project_rating' => 'projects.show',
            'project_note_updated' => 'projects.show',
            'project_note_mention' => 'projects.show',
            'project_member_mention' => 'projects.show',
            'new_expense_admin' => 'expenses.show',
            'new_expense_member' => 'expenses.show',
            'new_expense_status' => 'expenses.show',
            'invoice_payment_received' => 'invoices.show',
            'new_invoice' => 'invoices.show',
            'invoice_updated' => 'invoices.show',
            'invoice_reminder' => 'invoices.show',
            'invoice_reminder_after' => 'invoices.show',
            'leave_application' => 'leaves.show',
            'leave_status_approve' => 'leaves.show',
            'leave_status_reject' => 'leaves.show',
            'leave_status_update' => 'leaves.show',
            'new_leave_request' => 'leaves.show',
            'new_multiple_leave_request' => 'leaves.show',
            'multiple_leave_application' => 'leaves.show',
            'event_invite' => 'events.show',
            'event_reminder' => 'events.show',
            'event_invite_mention' => 'events.show',
            'event_host_invite' => 'events.show',
            'event_completed' => 'events.show',
            'event_status_note' => 'events.show',
            'new_appreciation' => 'appreciations.show',
            'contract_signed' => 'contracts.show',
            'new_contract' => 'contracts.show',
            'new_discussion' => 'discussion.show',
            'new_discussion_reply' => 'discussion.show',
            'new_discussion_mention' => 'discussion.show',
            'shift_scheduled' => 'attendances.index',
            'shift_change_status' => 'attendances.index',
            'shift_change_request' => 'attendances.index',
            'bulk_shift_notification' => 'attendances.index',
            'shift_rotation_notification' => 'attendances.index',
            'promotion_added' => 'employees.show',
            'promotion_updated' => 'employees.show',
            'new_estimate' => 'estimates.show',
            'estimate_accepted' => 'estimates.show',
            'estimate_declined' => 'estimates.show',
            'new_proposal' => 'proposals.show',
            'proposal_signed' => 'proposals.show',
            'new_payment' => 'payments.show',
            'payment_reminder' => 'payments.show',
            'new_order' => 'orders.show',
            'order_updated' => 'orders.show',
        ];
    }

    /**
     * Get notification icon based on type.
     */
    protected function getNotificationIcon(string $typeSlug): string
    {
        $icons = [
            // Tasks
            'new_task' => 'task',
            'task_completed' => 'task-completed',
            'task_completed_client' => 'task-completed',
            'task_updated' => 'task',
            'task_updated_client' => 'task',
            'task_comment' => 'comment',
            'task_comment_admin' => 'comment',
            'task_comment_client' => 'comment',
            'task_comment_mention' => 'comment',
            'task_status_updated' => 'task',
            'task_note' => 'comment',
            'task_note_client' => 'comment',
            'task_note_mention' => 'comment',
            'task_mention' => 'task',
            'task_reminder' => 'task',
            'task_lifecycle_created_notification' => 'task',
            'task_lifecycle_updated_notification' => 'task',
            'task_lifecycle_due_notification' => 'task',
            'task_lifecycle_completed_notification' => 'task-completed',
            'task_approval' => 'task',
            'auto_task_reminder' => 'task',
            'new_client_task' => 'task',
            'sub_task_created' => 'task',
            'sub_task_completed' => 'task-completed',
            'sub_task_assignee_added' => 'task',
            'task_deleted' => 'task',
            'task_rejected' => 'task',
            'task_overdue' => 'task',
            'task_priority_updated' => 'task',

            // Notices
            'new_notice' => 'notice',
            'notice_update' => 'notice',

            // Chat
            'new_chat' => 'chat',
            'new_mention_chat' => 'chat',

            // Tickets
            'new_ticket' => 'ticket',
            'new_ticket_reply' => 'ticket',
            'new_ticket_requester' => 'ticket',
            'new_ticket_note' => 'ticket',
            'ticket_agent' => 'ticket',
            'mention_ticket_agent' => 'ticket',

            // Deals / Leads
            'new_lead_created' => 'lead',
            'lead_owner_assigned' => 'lead',
            'lead_agent_assigned' => 'lead',
            'deal_stage_updated' => 'deal',
            'deal_activity_notification' => 'deal',
            'auto_follow_up_reminder' => 'deal',
            'new_communication_activity' => 'deal',
            'lead_imported' => 'lead',
            'lead_deleted' => 'lead',
            'lead_follow_up_overdue' => 'event',
            'deal_deleted' => 'deal',
            'deal_close_date_approaching' => 'deal',

            // Properties
            'property_activity_notification' => 'property',
            'expose_ready_notification' => 'file',
            'availability_requested' => 'property',
            'availability_response' => 'property',
            'availability_escalation' => 'property',
            'availability_escalation_reminder' => 'property',
            'edit_access_requested' => 'property',
            'edit_access_reviewed' => 'property',
            'property_access_request' => 'property',
            'publish_request_submitted' => 'property',
            'publish_request_reviewed' => 'property',

            // Projects
            'new_project' => 'project',
            'new_project_member' => 'project',
            'new_project_status' => 'project',
            'new_project_note' => 'project',
            'project_reminder' => 'project',
            'project_rating' => 'project',
            'project_note_updated' => 'project',
            'project_note_mention' => 'project',
            'project_member_mention' => 'project',

            // Expenses
            'new_expense_admin' => 'expense',
            'new_expense_member' => 'expense',
            'new_expense_status' => 'expense',

            // Invoices
            'invoice_payment_received' => 'invoice',
            'new_invoice' => 'invoice',
            'invoice_updated' => 'invoice',
            'invoice_reminder' => 'invoice',
            'invoice_reminder_after' => 'invoice',

            // Leaves
            'leave_application' => 'leave',
            'leave_status_approve' => 'leave-approved',
            'leave_status_reject' => 'leave-rejected',
            'leave_status_update' => 'leave',
            'new_leave_request' => 'leave',
            'new_multiple_leave_request' => 'leave',
            'multiple_leave_application' => 'leave',

            // Events
            'event_invite' => 'event',
            'event_reminder' => 'event',
            'event_invite_mention' => 'event',
            'event_host_invite' => 'event',
            'event_completed' => 'event',
            'event_status_note' => 'event',

            // Appreciations & Birthday
            'new_appreciation' => 'appreciation',
            'birthday_reminder' => 'birthday',

            // Contracts
            'contract_signed' => 'contract',
            'new_contract' => 'contract',

            // Discussions
            'new_discussion' => 'discussion',
            'new_discussion_reply' => 'discussion',
            'new_discussion_mention' => 'discussion',

            // Shifts
            'shift_scheduled' => 'shift',
            'shift_change_status' => 'shift',
            'shift_change_request' => 'shift',
            'bulk_shift_notification' => 'shift',
            'shift_rotation_notification' => 'shift',

            // Promotions
            'promotion_added' => 'promotion',
            'promotion_updated' => 'promotion',

            // Entity reminders (tasks, deals, leads, meetings, notes, properties, projects, units, flights)
            'reminder_notification' => 'reminder',
        ];

        return $icons[$typeSlug] ?? 'bell';
    }

    /**
     * Get all distinct notification types for a user.
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
