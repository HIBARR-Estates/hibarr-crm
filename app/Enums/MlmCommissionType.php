<?php

namespace App\Enums;

enum MlmCommissionType: string
{
    case Agent = 'agent';
    case Upline = 'upline';
    case System = 'system';

    public function label(): string
    {
        return match ($this) {
            self::Agent => __('app.mlmCommissionType.agent'),
            self::Upline => __('app.mlmCommissionType.upline'),
            self::System => __('app.mlmCommissionType.system'),
        };
    }

    public static function toArray(): array
    {
        return array_map(fn (self $case) => $case->value, self::cases());
    }
}
