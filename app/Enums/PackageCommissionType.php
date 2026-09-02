<?php

namespace App\Enums;

enum PackageCommissionType: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';

    public function label(): string
    {
        return match ($this) {
            self::Percentage => __('app.packageCommissionType.percentage'),
            self::Fixed => __('app.packageCommissionType.fixed'),
        };
    }

    /**
     * @return array<int, string>
     */
    public static function toArray(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
