<?php

namespace App\Enums;

enum MlmCommissionStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Reverted = 'reverted';

    public function label(): string
    {
        return match ($this) {
            self::Pending => __('app.mlmCommissionStatus.pending'),
            self::Paid => __('app.mlmCommissionStatus.paid'),
            self::Reverted => __('app.mlmCommissionStatus.reverted'),
        };
    }

    public static function toArray(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
