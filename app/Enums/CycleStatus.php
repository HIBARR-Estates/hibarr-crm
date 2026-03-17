<?php

namespace App\Enums;

enum CycleStatus: string
{
    case Upcoming = 'upcoming';
    case Active = 'active';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Upcoming => 'Upcoming',
            self::Active => 'Active',
            self::Completed => 'Completed',
        };
    }
}
