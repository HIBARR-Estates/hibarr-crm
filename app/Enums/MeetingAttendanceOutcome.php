<?php

namespace App\Enums;

enum MeetingAttendanceOutcome: string
{
    case Attended = 'attended';
    case NoShow = 'no_show';
    case Rescheduled = 'rescheduled';
    case Cancelled = 'cancelled';
    case Partial = 'partial';

    public function label(): string
    {
        return match ($this) {
            self::Attended => 'Attended',
            self::NoShow => 'Did not attend (no-show)',
            self::Rescheduled => 'Rescheduled / postponed',
            self::Cancelled => 'Cancelled',
            self::Partial => 'Partially attended',
        };
    }

    public function helper(): string
    {
        return match ($this) {
            self::Attended => 'Showed up as planned',
            self::NoShow => 'Missed it without notice',
            self::Rescheduled => 'Moved to a new date or time',
            self::Cancelled => 'Meeting will not take place',
            self::Partial => 'Left early or joined late',
        };
    }

    public function confirmLabel(): string
    {
        return match ($this) {
            self::Attended => 'Mark as attended',
            self::NoShow => 'Mark as no-show',
            self::Rescheduled => 'Mark as rescheduled',
            self::Cancelled => 'Mark as cancelled',
            self::Partial => 'Mark as partial',
        };
    }

    /**
     * How this outcome should move the follow-up's existing `status` column
     * (scheduled|completed|cancelled) — kept separate from this enum so the
     * DB-level status enum never needs an ALTER.
     */
    public function followUpStatus(): string
    {
        return match ($this) {
            self::Cancelled => 'cancelled',
            default => 'completed',
        };
    }
}
