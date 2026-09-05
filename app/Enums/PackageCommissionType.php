<?php

namespace App\Enums;

enum PackageCommissionType: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';
    /**
     * Explicitly zero — distinct from a null commission_type, which means
     * "no package-level setting, fall through to the level-based split".
     * A None package (or override) pays nothing, and does not fall through.
     */
    case None = 'none';

    public function label(): string
    {
        return match ($this) {
            self::Percentage => __('app.packageCommissionType.percentage'),
            self::Fixed => __('app.packageCommissionType.fixed'),
            self::None => __('app.packageCommissionType.none'),
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
