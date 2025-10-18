<?php

namespace App\Enums;

enum MeetingType: string
{

    // phpcs:disable
    case KickOff = 'kick_off';
 
    // phpcs:enable

    public static function getValues()
    {
        return array_map(function($enum) {
            return $enum->value;
        }, self::cases());
    }

}
