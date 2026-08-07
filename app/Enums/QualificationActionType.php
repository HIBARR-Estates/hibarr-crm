<?php

namespace App\Enums;

enum QualificationActionType: string
{
    case BookConsultation = 'book_consultation';
    case InviteWebinar = 'invite_webinar';
    case ScheduleCallback = 'schedule_callback';
    case MarkNoFit = 'mark_no_fit';
    case CreateTask = 'create_task';
    case ScheduleMeeting = 'schedule_meeting';
    case CreateDeal = 'create_deal';
    case AddNote = 'add_note';
    case LogActivity = 'log_activity';
    case SendEmail = 'send_email';
    case SendSms = 'send_sms';
    case AssignOwner = 'assign_owner';

    public function label(): string
    {
        return match ($this) {
            self::BookConsultation => 'Book consultation',
            self::InviteWebinar => 'Invite to webinar',
            self::ScheduleCallback => 'Schedule callback',
            self::MarkNoFit => 'Mark not a fit',
            self::CreateTask => 'Create task',
            self::ScheduleMeeting => 'Schedule meeting',
            self::CreateDeal => 'Create deal',
            self::AddNote => 'Add note',
            self::LogActivity => 'Log activity',
            self::SendEmail => 'Send email',
            self::SendSms => 'Send SMS',
            self::AssignOwner => 'Assign owner',
        };
    }

    /**
     * @return list<string>
     */
    public function optionalConfigKeys(): array
    {
        return match ($this) {
            self::BookConsultation => ['calendlyUrl'],
            self::InviteWebinar => ['webinarId'],
            default => [],
        };
    }

    public function requiresRuntimePayload(): bool
    {
        return match ($this) {
            self::InviteWebinar => true,
            self::CreateTask, self::ScheduleMeeting, self::CreateDeal, self::AddNote,
            self::LogActivity, self::SendEmail, self::SendSms, self::AssignOwner => true,
            default => false,
        };
    }
}
