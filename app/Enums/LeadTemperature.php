<?php

namespace App\Enums;

enum LeadTemperature: string
{
    case Cold = 'cold';
    case Warm = 'warm';
    case Hot = 'hot';

    public function label(): string
    {
        return match ($this) {
            self::Cold => 'Cold',
            self::Warm => 'Warm',
            self::Hot => 'Hot',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
