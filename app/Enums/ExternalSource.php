<?php

namespace App\Enums;

/**
 * External origin of a note or task — null means created by a CRM user.
 */
enum ExternalSource: string
{
    case MEETING_BOT = 'meeting_bot';
    case SALLY = 'sally';
    case MAX = 'max';

    public function label(): string
    {
        return match ($this) {
            self::MEETING_BOT => 'Meeting Bot',
            self::SALLY => 'Sally',
            self::MAX => 'Max',
        };
    }
}
