<?php

namespace App\Enums;

/**
 * Defines the direction / flow of a CRM event (nullable — not all events have a direction).
 */
enum CrmEventDirection: string
{
    case INBOUND = 'inbound';
    case OUTBOUND = 'outbound';

    /**
     * Get the human-readable label for this direction.
     */
    public function label(): string
    {
        return match ($this) {
            self::INBOUND => 'Inbound',
            self::OUTBOUND => 'Outbound',
        };
    }

    /**
     * Get the badge colour key for UI rendering.
     */
    public function color(): string
    {
        return match ($this) {
            self::INBOUND => 'cyan',
            self::OUTBOUND => 'geekblue',
        };
    }
}
