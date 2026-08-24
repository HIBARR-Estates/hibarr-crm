<?php

namespace App\Enums;

enum QualificationOutcome: string
{
    case BookMeeting = 'bookMeeting';
    case InviteWebinar = 'inviteWebinar';
    case Callback = 'callback';
    case NoFit = 'noFit';

    public function lifecycleStatusKey(): string
    {
        return match ($this) {
            self::BookMeeting => 'qualified',
            self::InviteWebinar => 'nurturing',
            self::Callback => 'callback',
            self::NoFit => 'lost',
        };
    }
}
