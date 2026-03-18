<?php

namespace App\Enums;

/**
 * Defines event generation types — whether an event was initiated by a user, the system, or an external source.
 */
enum CrmEventGenerationType: string
{
    case USER_GENERATED = 'user_generated';
    case SYSTEM_GENERATED = 'system_generated';
    case EXTERNAL = 'external';

    /**
     * Get the human-readable label for this generation type.
     */
    public function label(): string
    {
        return match ($this) {
            self::USER_GENERATED => 'User Generated',
            self::SYSTEM_GENERATED => 'System Generated',
            self::EXTERNAL => 'External',
        };
    }
}
