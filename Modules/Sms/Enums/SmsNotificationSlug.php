<?php

namespace Modules\Sms\Enums;

enum SmsNotificationSlug: string
{
    // phpcs:disable
    case AttendanceReminder = 'attendance-reminder';
    case FollowUpReminder = 'follow-up-reminder';
    case AutoTaskReminder = 'auto-task-reminder';
    case ContractSigned = 'contract-signed';
    case EstimateDeclined = 'estimate-declined';
    case EventInvite = 'event-invite';
    case EventReminder = 'event-reminder';
    case RecurringExpenseStatusUpdated = 'recurring-expense-status-updated';
    case NewFileUploadedToProject = 'new-file-uploaded-to-project';
    case PaymentReceived = 'payment-received';
    case PaymentReminder = 'payment-reminder';
    case ProjectReminder = 'project-reminder';
    case ProposalApproved = 'proposal-approved';
    case ProposalRejected = 'proposal-rejected';
    case RecurringInvoiceStatusUpdated = 'recurring-invoice-status-updated';
    case InvoiceReminder = 'invoice-reminder';
    case NewExpenseAddedByAdmin = 'new-expense-added-by-admin';
    case NewExpenseAddedByMember = 'new-expense-added-by-member';
    case InvoiceCreated = 'invoice-created';
    case InvoiceUpdated = 'invoice-updated';
    case LeadNotification = 'lead-notification';
    case NewLeaveApplication = 'new-leave-application';
    case NewLeaveRequest = 'new-leave-request';
    case LeaveApproved = 'leave-approved';
    case LeaveRejected = 'leave-rejected';
    case LeaveUpdated = 'leave-updated';
    case MultipleLeaveApplication = 'multiple-leave-application';
    case NewMultipleLeaveApplication = 'new-multiple-leave-application';
    case NewTask = 'new-task';
    case NewOrder = 'new-order';
    case OrderUpdated = 'order-updated';
    case NewPayment = 'new-payment';
    case NewProductPurchase = 'new-product-purchase';
    case NewProject = 'new-project';
    case NewProposal = 'new-proposal';
    case NewRecurringInvoice = 'new-recurring-invoice';
    case NewTicketReply = 'new-ticket-reply';
    case NewTicketRequest = 'new-ticket-request';
    case TaskUpdated = 'task-updated';
    case TaskStatusUpdated = 'task-status-changed';
    case TaskMentionSms = 'task-mention-notification';
    case TaskCompletedClient = 'task-completed-client';
    case TaskCompleted = 'task-completed';
    case NewClientTask = 'new-client-task';
    case TaskUpdateClient = 'task-update-client';
    case NewNoticePublished = 'new-notice-published';
    case NewSupportTicketRequest = 'new-support-ticket-request';
    case AgentTicket = 'agent-ticket';
    case EmployeeAssignToProject = 'employee-assign-to-project';
    case UserJoinViaInvitation = 'user-join-via-invitation';
    case NoticeUpdated = 'notice-updated';
    case RemovalRequestAdminNotification = 'removal-request-admin-notification';
    case RemovalRequestApproved = 'removal-request-approved';
    case RemovalRequestReject = 'removal-request-reject';
    case RemovalRequestApprovedLead = 'removal-request-approved-lead';
    case RemovalRequestRejectLead = 'removal-request-reject-lead';
    case SubTaskAssigneeAdded = 'sub-task-assignee-added';
    case SubTaskCompleted = 'sub-task-completed';
    case TaskComment = 'task-comment';
    case TaskNote = 'task-note';
    case TaskReminder = 'task-reminder';
    case UserRegistrationAddedByAdmin = 'user-registrationadded-by-admin';
    case TestSmsNotification = 'test-sms-notification';
    case TwoFactorCode = 'two-factor-code';
    case RemovalRequestRejectUser = 'removal-request-reject-user';
    case RemovalRequestApprovedUser = 'removal-request-approved-user';
    // phpcs:enable

    public function whatsappTemplate(): string
    {
        return match ($this) {
            self::AttendanceReminder => __($this->translationString()),
            self::FollowUpReminder => __($this->translationString(), ['leadId' => '{{1}}', 'followUpDate' => '{{2}}', 'remark' => '{{3}}']),
            self::AutoTaskReminder => __($this->translationString(), ['taskId' => '{{1}}', 'heading' => '{{2}}', 'dueDate' => '{{3}}']),
            self::ContractSigned => __($this->translationString(), ['contract' => '{{1}}', 'client' => '{{2}}']),
            self::EstimateDeclined => __($this->translationString(), ['estimateNumber' => '{{1}}']),
            self::EventInvite => __($this->translationString(), ['eventName' => '{{1}}', 'eventStartDate' => '{{2}}', 'eventEndDate' => '{{3}}', 'eventLocation' => '{{4}}']),
            self::EventReminder => __($this->translationString(), ['eventName' => '{{1}}', 'eventStartDate' => '{{2}}', 'eventEndDate' => '{{3}}', 'eventLocation' => '{{4}}']),
            self::RecurringExpenseStatusUpdated => __($this->translationString(), ['expenseName' => '{{1}}', 'expenseStatus' => '{{2}}']),
            self::NewFileUploadedToProject => __($this->translationString(), ['projectName' => '{{1}}', 'fileName' => '{{2}}', 'date' => '{{3}}']),
            self::PaymentReceived => __($this->translationString(), ['paymentType' => '{{1}}', 'number' => '{{2}}']),
            self::PaymentReminder => __($this->translationString(), ['invoiceNumber' => '{{1}}', 'dueDate' => '{{2}}']),
            self::ProjectReminder => __($this->translationString(), ['dueDate' => '{{1}}']),
            self::ProposalApproved => __($this->translationString(), ['name' => '{{1}}', 'status' => '{{2}}']),
            self::ProposalRejected => __($this->translationString(), ['comment' => '{{1}}', 'status' => '{{2}}']),
            self::RecurringInvoiceStatusUpdated => __($this->translationString(), ['status' => '{{1}}']),
            self::InvoiceReminder => __($this->translationString(), ['invoiceNumber' => '{{1}}', 'dueDate' => '{{2}}']),
            self::NewExpenseAddedByAdmin => __($this->translationString(), ['name' => '{{1}}', 'itemName' => '{{2}}', 'price' => '{{3}}']),
            self::NewExpenseAddedByMember => __($this->translationString(), ['itemName' => '{{1}}', 'price' => '{{2}}']),
            self::InvoiceCreated => __($this->translationString(), ['invoiceNumber' => '{{1}}']),
            self::InvoiceUpdated => __($this->translationString(), ['invoiceNumber' => '{{1}}']),
            self::LeadNotification => __($this->translationString(), ['leadName' => '{{1}}']),
            self::NewLeaveApplication => __($this->translationString(), ['leaveDate' => '{{1}}']),
            self::NewLeaveRequest => __($this->translationString(), ['leaveDate' => '{{1}}', 'reason' => '{{2}}']),
            self::LeaveApproved => __($this->translationString(), ['leaveDate' => '{{1}}']),
            self::LeaveRejected => __($this->translationString(), ['leaveDate' => '{{1}}']),
            self::LeaveUpdated => __($this->translationString(), ['status' => '{{1}}']),
            self::MultipleLeaveApplication => __($this->translationString(), ['name' => '{{1}}', 'reason' => '{{2}}']),
            self::NewMultipleLeaveApplication => __($this->translationString(), ['name' => '{{1}}', 'reason' => '{{2}}', 'leaveType' => '{{3}}']),
            self::NewTask => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'dueDate' => '{{3}}']),
            self::NewOrder => __($this->translationString(), ['orderNumber' => '{{1}}']),
            self::OrderUpdated => __($this->translationString(), ['orderNumber' => '{{1}}']),
            self::NewPayment => __($this->translationString()),
            self::NewProductPurchase => __($this->translationString()),
            self::NewProject => __($this->translationString(), ['projectName' => '{{1}}']),
            self::NewProposal => __($this->translationString()),
            self::NewRecurringInvoice => __($this->translationString()),
            self::NewTicketReply => __($this->translationString(), ['ticketNumber' => '{{1}}']),
            self::NewTicketRequest => __($this->translationString()),
            self::TaskUpdated => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'dueDate' => '{{3}}']),
            self::TaskStatusUpdated => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'status' => '{{3}}']),
            self::TaskMentionSms => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'dueDate' => '{{3}}']),
            self::TaskCompletedClient => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}']),
            self::TaskCompleted => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'project' => '{{3}}']),
            self::NewClientTask => __($this->translationString(), ['heading' => '{{1}}']),
            self::TaskUpdateClient => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}']),
            self::NewNoticePublished => __($this->translationString(), ['heading' => '{{1}}']),
            self::NewSupportTicketRequest => __($this->translationString(), ['ticketId' => '{{1}}', 'subject' => '{{2}}', 'ticketRequesterName' => '{{3}}']),
            self::AgentTicket => __($this->translationString(), ['ticketId' => '{{1}}', 'subject' => '{{2}}']),
            self::EmployeeAssignToProject => __($this->translationString(), ['projectName' => '{{1}}']),
            self::UserJoinViaInvitation => __($this->translationString(), ['name' => '{{1}}', 'email' => '{{2}}', 'phone' => '{{3}}']),
            self::NoticeUpdated => __($this->translationString(), ['heading' => '{{1}}']),
            self::RemovalRequestAdminNotification => __($this->translationString()),
            self::RemovalRequestApproved => __($this->translationString()),
            self::RemovalRequestReject => __($this->translationString()),
            self::RemovalRequestApprovedLead => __($this->translationString()),
            self::RemovalRequestRejectLead => __($this->translationString()),
            self::SubTaskAssigneeAdded => __($this->translationString(), ['title' => '{{1}}', 'project' => '{{2}}']),
            self::SubTaskCompleted => __($this->translationString(), ['title' => '{{1}}', 'project' => '{{2}}']),
            self::TaskComment => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'project' => '{{3}}']),
            self::TaskNote => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'project' => '{{3}}']),
            self::TaskReminder => __($this->translationString(), ['heading' => '{{1}}', 'taskId' => '{{2}}', 'date' => '{{3}}']),
            self::UserRegistrationAddedByAdmin => __($this->translationString(), ['name' => '{{1}}', 'email' => '{{2}}', 'password' => '{{3}}']),
            self::TestSmsNotification => __($this->translationString(), ['gateway' => 'whatsapp']),
            self::TwoFactorCode => __($this->translationString(), ['code' => '{{1}}']),
            self::RemovalRequestRejectUser => __($this->translationString()),
            self::RemovalRequestApprovedUser => __($this->translationString()),
            default => __($this->translationString()),
        };

    }

    public function msg91Template(): string
    {
        return match ($this) {
            self::AttendanceReminder => __($this->translationString()),
            self::FollowUpReminder => __($this->translationString(), ['leadId' => '##lead_id##', 'followUpDate' => '##follow_up_date##', 'remark' => '##remark##']),
            self::AutoTaskReminder => __($this->translationString(), ['taskId' => '##task_id##', 'heading' => '##heading##', 'dueDate' => '##due_date##']),
            self::ContractSigned => __($this->translationString(), ['contract' => '##contract##', 'client' => '##client##']),
            self::EstimateDeclined => __($this->translationString(), ['estimateNumber' => '##estimate_number##']),
            self::EventInvite => __($this->translationString(), ['eventName' => '##event_name##', 'eventStartDate' => '##event_start_date##', 'eventEndDate' => '##event_end_date##', 'eventLocation' => '##event_location##']),
            self::EventReminder => __($this->translationString(), ['eventName' => '##event_name##', 'eventStartDate' => '##event_start_date##', 'eventEndDate' => '##event_end_date##', 'eventLocation' => '##event_location##']),
            self::RecurringExpenseStatusUpdated => __($this->translationString(), ['expenseName' => '##expense_name##', 'expenseStatus' => '##expense_status##']),
            self::NewFileUploadedToProject => __($this->translationString(), ['projectName' => '##project_name##', 'fileName' => '##file_name##', 'date' => '##date##']),
            self::PaymentReceived => __($this->translationString(), ['paymentType' => '##payment_type##', 'number' => '##number##']),
            self::PaymentReminder => __($this->translationString(), ['invoiceNumber' => '##invoice_number##', 'dueDate' => '##due_date##']),
            self::ProjectReminder => __($this->translationString(), ['dueDate' => '##due_date##']),
            self::ProposalApproved => __($this->translationString(), ['name' => '##name##', 'status' => '##status##']),
            self::ProposalRejected => __($this->translationString(), ['comment' => '##comment##', 'status' => '##status##']),
            self::RecurringInvoiceStatusUpdated => __($this->translationString(), ['status' => '##status##']),
            self::InvoiceReminder => __($this->translationString(), ['invoiceNumber' => '##invoice_number##', 'dueDate' => '##due_date##']),
            self::NewExpenseAddedByAdmin => __($this->translationString(), ['name' => '##name##', 'itemName' => '##item_name##', 'price' => '##price##']),
            self::NewExpenseAddedByMember => __($this->translationString(), ['itemName' => '##item_name##', 'price' => '##price##']),
            self::InvoiceCreated => __($this->translationString(), ['invoiceNumber' => '##invoice_number##']),
            self::InvoiceUpdated => __($this->translationString(), ['invoiceNumber' => '##invoice_number##']),
            self::LeadNotification => __($this->translationString(), ['leadName' => '##lead_name##']),
            self::NewLeaveApplication => __($this->translationString(), ['leaveDate' => '##leave_date##']),
            self::NewLeaveRequest => __($this->translationString(), ['leaveDate' => '##leave_date##', 'reason' => '##reason##']),
            self::LeaveApproved => __($this->translationString(), ['leaveDate' => '##leave_date##']),
            self::LeaveRejected => __($this->translationString(), ['leaveDate' => '##leave_date##']),
            self::LeaveUpdated => __($this->translationString(), ['status' => '##status##']),
            self::MultipleLeaveApplication => __($this->translationString(), ['name' => '##name##', 'reason' => '##reason##']),
            self::NewMultipleLeaveApplication => __($this->translationString(), ['name' => '##name##', 'reason' => '##reason##', 'leaveType' => '##leave_type##']),
            self::NewTask => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'dueDate' => '##due_date##']),
            self::NewOrder => __($this->translationString(), ['orderNumber' => '##order_number##']),
            self::OrderUpdated => __($this->translationString(), ['orderNumber' => '##order_number##']),
            self::NewPayment => __($this->translationString()),
            self::NewProductPurchase => __($this->translationString()),
            self::NewProject => __($this->translationString(), ['projectName' => '##project_name##']),
            self::NewProposal => __($this->translationString()),
            self::NewRecurringInvoice => __($this->translationString()),
            self::NewTicketReply => __($this->translationString(), ['ticketNumber' => '##ticket_number##']),
            self::NewTicketRequest => __($this->translationString()),
            self::TaskUpdated => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'dueDate' => '##due_date##']),
            self::TaskStatusUpdated => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'status' => '##status##']),
            self::TaskMentionSms => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'dueDate' => '##due_date##']),
            self::TaskCompletedClient => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##']),
            self::TaskCompleted => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'project' => '##project##']),
            self::NewClientTask => __($this->translationString(), ['heading' => '##heading##']),
            self::TaskUpdateClient => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##']),
            self::NewNoticePublished => __($this->translationString(), ['heading' => '##heading##']),
            self::NewSupportTicketRequest => __($this->translationString(), ['ticketId' => '##ticket_id##', 'subject' => '##subject##', 'ticketRequesterName' => '##ticket_requester_name##']),
            self::AgentTicket => __($this->translationString(), ['ticketId' => '##ticket_id##', 'subject' => '##subject##']),
            self::EmployeeAssignToProject => __($this->translationString(), ['projectName' => '##project_name##']),
            self::UserJoinViaInvitation => __($this->translationString(), ['name' => '##name##', 'email' => '##email##', 'phone' => '##phone##']),
            self::NoticeUpdated => __($this->translationString(), ['heading' => '##heading##']),
            self::RemovalRequestAdminNotification => __($this->translationString()),
            self::RemovalRequestApproved => __($this->translationString()),
            self::RemovalRequestReject => __($this->translationString()),
            self::RemovalRequestApprovedLead => __($this->translationString()),
            self::RemovalRequestRejectLead => __($this->translationString()),
            self::SubTaskAssigneeAdded => __($this->translationString(), ['title' => '##title##', 'project' => '##project##']),
            self::SubTaskCompleted => __($this->translationString(), ['title' => '##title##', 'project' => '##project##']),
            self::TaskComment => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'project' => '##project##']),
            self::TaskNote => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'project' => '##project##']),
            self::TaskReminder => __($this->translationString(), ['heading' => '##heading##', 'taskId' => '##task_id##', 'date' => '##date##']),
            self::UserRegistrationAddedByAdmin => __($this->translationString(), ['name' => '##name##', 'email' => '##email##', 'password' => '##password##']),
            self::TestSmsNotification => __($this->translationString(), ['gateway' => 'msg91']),
            self::TwoFactorCode => __($this->translationString(), ['code' => '##two_factor_code##']),
            self::RemovalRequestRejectUser => __($this->translationString()),
            self::RemovalRequestApprovedUser => __($this->translationString()),
            default => __($this->translationString()),
        };
    }

    public function translationString(): string
    {
        return 'sms::template.' . $this->value;
    }

    public function label(): string
    {
        return __('modules.emailNotification.' . $this->value);
    }

}
