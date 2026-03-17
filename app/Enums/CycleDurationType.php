<?php

namespace App\Enums;

enum CycleDurationType: string
{
    case Monthly = 'monthly';
    case Quarterly = 'quarterly';
    case Custom = 'custom';

    /**
     * Get the default number of days for this duration type.
     * For Custom, returns null (must be set via duration_days column).
     */
    public function defaultDays(): ?int
    {
        return match ($this) {
            self::Monthly => 30,
            self::Quarterly => 90,
            self::Custom => null,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Monthly => 'Monthly',
            self::Quarterly => 'Quarterly',
            self::Custom => 'Custom',
        };
    }
}
