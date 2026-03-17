<?php

namespace App\Enums;

enum EnrollmentStatus: string
{
    case Active = 'active';
    case Extended = 'extended';
    case Completed = 'completed';
    case ForceCompleted = 'force_completed';

    public function label(): string
    {
        return match ($this) {
            self::Active => 'Active',
            self::Extended => 'Extended (Overflow)',
            self::Completed => 'Completed',
            self::ForceCompleted => 'Force Completed',
        };
    }

    /**
     * Whether this enrollment is still receiving metrics.
     */
    public function isReceivingMetrics(): bool
    {
        return match ($this) {
            self::Active, self::Extended => true,
            self::Completed, self::ForceCompleted => false,
        };
    }
}
