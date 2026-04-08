<?php

namespace App\Enums;

enum OfferType: string
{
    case PERCENTAGE = 'percentage';
    case FIXED = 'fixed';
    case PERKS = 'perks';

    public function label(): string
    {
        return match ($this) {
            self::PERCENTAGE => 'Percentage',
            self::FIXED => 'Fixed Amount',
            self::PERKS => 'Perks',
        };
    }
}
