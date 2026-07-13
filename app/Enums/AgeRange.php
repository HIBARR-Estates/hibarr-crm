<?php

namespace App\Enums;

enum AgeRange: string
{
    case Under20 = 'under 20';
    case From20To25 = '20-25';
    case From26To30 = '26-30';
    case From31To40 = '31-40';
    case From41To50 = '41-50';
    case From51To65 = '51-65';
    case Above66 = 'above 66';

    public function label(): string
    {
        return match ($this) {
            self::Under20 => 'Under 20',
            self::From20To25 => '20-25',
            self::From26To30 => '26-30',
            self::From31To40 => '31-40',
            self::From41To50 => '41-50',
            self::From51To65 => '51-65',
            self::Above66 => 'Above 66',
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
