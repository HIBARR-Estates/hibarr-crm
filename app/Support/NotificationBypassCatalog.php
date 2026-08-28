<?php

namespace App\Support;

/**
 * Allowlist of notification classes a user may fully suppress.
 * Types not listed cannot be bypassed (fail closed).
 */
class NotificationBypassCatalog
{
    /**
     * Security / account / diagnostic types — never bypassable.
     *
     * @var list<string>
     */
    public const DENYLIST = [
        'TwoFactorCode',
        'ResetPassword',
        'EmployeePasswordResetNotification',
        'NewUser',
        'NewUserViaLink',
        'NewUserSlack',
        'InvitationEmail',
        'TestEmail',
        'TestPush',
        'TestSlack',
    ];

    /**
     * @var array<string, array<string, string>>
     */
    private const GROUPS = [
        'Deals' => [
            'DealActivityNotification' => 'Deal activity',
            'DealStageUpdated' => 'Deal stage updated',
            'DealDeleted' => 'Deal deleted',
            'DealCloseDateApproaching' => 'Deal close date approaching',
            'AutoFollowUpReminder' => 'Follow-up reminder',
            'BulkActionCompleted' => 'Bulk action completed',
        ],
        'Leads' => [
            'LeadActivityNotification' => 'Lead activity',
            'NewLeadCreated' => 'New lead created',
            'LeadImported' => 'Lead imported',
            'LeadDeleted' => 'Lead deleted',
            'LeadOwnerAssigned' => 'Lead owner assigned',
            'LeadAgentAssigned' => 'Lead agent assigned',
            'LeadFollowUpOverdue' => 'Lead follow-up overdue',
            'LeadAutomationEmailNotification' => 'Lead automation email',
            'NewCustomer' => 'New customer',
            'RemovalRequestApprovedRejectLead' => 'Lead removal request',
        ],
        'Meetings' => [
            'MeetingLinkGenerationFailed' => 'Meeting link generation failed',
            'MeetingSummaryNotification' => 'Meeting summary',
            'EventInvite' => 'Event invite',
            'EventHostInvite' => 'Event host invite',
            'EventInviteMention' => 'Event invite mention',
            'EventReminder' => 'Event reminder',
            'EventCompleted' => 'Event completed',
            'EventStatusNote' => 'Event status note',
            'AvailabilityRequested' => 'Availability requested',
            'AvailabilityResponse' => 'Availability response',
            'AvailabilityEscalation' => 'Availability escalation',
            'AvailabilityEscalationReminder' => 'Availability escalation reminder',
        ],
        'Tasks' => [
            'NewTask' => 'New task',
            'NewClientTask' => 'New client task',
            'TaskUpdated' => 'Task updated',
            'TaskUpdatedClient' => 'Task updated (client)',
            'TaskCompleted' => 'Task completed',
            'TaskCompletedClient' => 'Task completed (client)',
            'TaskStatusUpdated' => 'Task status updated',
            'TaskReminder' => 'Task reminder',
            'AutoTaskReminder' => 'Automatic task reminder',
            'TaskOverdue' => 'Task overdue',
            'TaskOverdueForAssigner' => 'Task overdue (assigner)',
            'TaskDeleted' => 'Task deleted',
            'TaskRejected' => 'Task rejected',
            'TaskApproval' => 'Task approval',
            'TaskPriorityUpdated' => 'Task priority updated',
            'TaskComment' => 'Task comment',
            'TaskCommentAdmin' => 'Task comment (admin)',
            'TaskCommentClient' => 'Task comment (client)',
            'TaskCommentMention' => 'Task comment mention',
            'TaskNote' => 'Task note',
            'TaskNoteClient' => 'Task note (client)',
            'TaskNoteMention' => 'Task note mention',
            'TaskMention' => 'Task mention',
            'SubTaskCreated' => 'Subtask created',
            'SubTaskCompleted' => 'Subtask completed',
            'SubTaskAssigneeAdded' => 'Subtask assignee added',
            'TaskLifecycleCreatedNotification' => 'Task lifecycle created',
            'TaskLifecycleUpdatedNotification' => 'Task lifecycle updated',
            'TaskLifecycleDueNotification' => 'Task lifecycle due',
            'TaskLifecycleCompletedNotification' => 'Task lifecycle completed',
            'TimerStarted' => 'Timer started',
            'TimeTrackerReminder' => 'Time tracker reminder',
        ],
        'Projects' => [
            'NewProject' => 'New project',
            'NewProjectMember' => 'Added to project',
            'NewProjectStatus' => 'Project status changed',
            'NewProjectNote' => 'Project note',
            'ProjectNoteUpdated' => 'Project note updated',
            'ProjectNoteMention' => 'Project note mention',
            'ProjectMemberMention' => 'Project mention',
            'ProjectReminder' => 'Project reminder',
            'ProjectRating' => 'Project rating',
            'FileUpload' => 'File uploaded',
            'NewIssue' => 'New issue',
            'NewDiscussion' => 'New discussion',
            'NewDiscussionReply' => 'Discussion reply',
            'NewDiscussionMention' => 'Discussion mention',
            'ProjectTimelogNotification' => 'Project time log',
            'ProjectTimelogCreateNotification' => 'Project time log created',
            'ProjectTimelogCreatedNotification' => 'Project time log created (alt)',
            'ProjectTimelogApproveNotification' => 'Project time log approved',
        ],
        'Tickets' => [
            'NewTicket' => 'New ticket',
            'NewTicketRequester' => 'Ticket requester',
            'TicketAgent' => 'Ticket assigned',
            'MentionTicketAgent' => 'Ticket agent mention',
            'NewTicketReply' => 'Ticket reply',
            'MailTicketReply' => 'Ticket email reply',
            'NewTicketNote' => 'Ticket note',
        ],
        'Finance' => [
            'NewInvoice' => 'New invoice',
            'InvoiceUpdated' => 'Invoice updated',
            'NewInvoiceRecurring' => 'Recurring invoice',
            'NewRecurringInvoice' => 'New recurring invoice',
            'InvoiceRecurringStatus' => 'Recurring invoice status',
            'InvoicePaymentReceived' => 'Invoice payment received',
            'InvoiceReminder' => 'Invoice reminder',
            'InvoiceReminderAfter' => 'Invoice reminder (after due)',
            'PaymentReminder' => 'Payment reminder',
            'NewPayment' => 'New payment',
            'NewCreditNote' => 'New credit note',
            'NewEstimate' => 'New estimate',
            'EstimateAccepted' => 'Estimate accepted',
            'EstimateDeclined' => 'Estimate declined',
            'NewEstimateRequest' => 'Estimate request',
            'EstimateRequestInvite' => 'Estimate request invite',
            'EstimateRequestAccepted' => 'Estimate request accepted',
            'EstimateRequestRejected' => 'Estimate request rejected',
            'NewProposal' => 'New proposal',
            'ProposalSigned' => 'Proposal signed',
            'NewContract' => 'New contract',
            'ContractSigned' => 'Contract signed',
            'NewOrder' => 'New order',
            'OrderUpdated' => 'Order updated',
            'NewProductPurchaseRequest' => 'Product purchase request',
            'NewExpenseAdmin' => 'New expense (admin)',
            'NewExpenseMember' => 'New expense (member)',
            'NewExpenseStatus' => 'Expense status changed',
            'NewExpenseRecurringAdmin' => 'Recurring expense (admin)',
            'NewExpenseRecurringMember' => 'Recurring expense (member)',
            'ExpenseRecurringStatus' => 'Recurring expense status',
        ],
        'HR' => [
            'NewLeaveRequest' => 'New leave request',
            'LeaveApplication' => 'Leave application',
            'MultipleLeaveApplication' => 'Multiple leave application',
            'NewMultipleLeaveRequest' => 'Multiple leave request',
            'LeaveStatusApprove' => 'Leave approved',
            'LeaveStatusReject' => 'Leave rejected',
            'LeaveStatusUpdate' => 'Leave status updated',
            'AttendanceReminder' => 'Attendance reminder',
            'MonthlyAttendance' => 'Monthly attendance',
            'ShiftScheduled' => 'Shift scheduled',
            'BulkShiftNotification' => 'Bulk shift',
            'ShiftChangeRequest' => 'Shift change request',
            'ShiftChangeStatus' => 'Shift change status',
            'ShiftRotationNotification' => 'Shift rotation',
            'NewHoliday' => 'New holiday',
            'BirthdayReminder' => 'Birthday reminder',
            'NewAppreciation' => 'New appreciation',
            'PromotionAdded' => 'Promotion added',
            'PromotionUpdated' => 'Promotion updated',
            'DailyScheduleNotification' => 'Daily schedule',
            'DailyTimeLogReport' => 'Daily time-log report',
            'NewTimesheetApproval' => 'Timesheet approval',
            'WeeklyTimesheetApproved' => 'Weekly timesheet approved',
            'WeeklyTimesheetRejected' => 'Weekly timesheet rejected',
        ],
        'Properties' => [
            'PropertyActivityNotification' => 'Property activity',
            'PropertyAccessRequest' => 'Property access request',
            'PublishRequestSubmitted' => 'Publish request submitted',
            'PublishRequestReviewed' => 'Publish request reviewed',
            'EditAccessRequested' => 'Edit access requested',
            'EditAccessReviewed' => 'Edit access reviewed',
            'ExposeReadyNotification' => 'Exposé ready',
        ],
        'Communication' => [
            'NewNotice' => 'New notice',
            'NoticeUpdate' => 'Notice updated',
            'NewChat' => 'New chat message',
            'NewMentionChat' => 'Chat mention',
            'NewCommunicationActivity' => 'Communication activity',
            'CustomerCommunicationNotification' => 'Customer communication',
            'ReminderNotification' => 'Reminder',
        ],
        'Other' => [
            'MlmEventNotification' => 'Partner / MLM event',
            'PartnerFlagRaised' => 'Partner flag raised',
            'RemovalRequestAdminNotification' => 'Removal request (admin)',
            'RemovalRequestApprovedReject' => 'Removal request decision',
            'RemovalRequestApprovedRejectUser' => 'Removal request (user)',
        ],
    ];

    /**
     * @return list<array{key: string, label: string, group: string}>
     */
    public static function types(): array
    {
        $types = [];

        foreach (self::GROUPS as $group => $items) {
            foreach ($items as $key => $label) {
                $types[] = [
                    'key' => $key,
                    'label' => $label,
                    'group' => $group,
                ];
            }
        }

        return $types;
    }

    public static function isBypassable(string $key): bool
    {
        if (in_array($key, self::DENYLIST, true)) {
            return false;
        }

        foreach (self::GROUPS as $items) {
            if (array_key_exists($key, $items)) {
                return true;
            }
        }

        return false;
    }
}
