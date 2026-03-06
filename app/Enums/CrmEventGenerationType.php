<?php

namespace App\Enums;

/**
 * Defines event generation types — whether an event was initiated by a user or by the system.
 */
enum CrmEventGenerationType: string
{
    case USER_GENERATED = 'user_generated';
    case SYSTEM_GENERATED = 'system_generated';

    /**
     * Get the human-readable label for this generation type.
     */
    public function label(): string
    {
        return match ($this) {
            self::USER_GENERATED => 'User Generated',
            self::SYSTEM_GENERATED => 'System Generated',
        };
    }
}
