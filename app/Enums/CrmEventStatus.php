<?php

namespace App\Enums;

/**
 * Defines the outcome status of a CRM event.
 */
enum CrmEventStatus: string
{
    case COMPLETED = 'completed';
    case ERROR_OCCURRED = 'error_occurred';
    case MISSED = 'missed';
    case REJECTED = 'rejected';
    /** A call that connected, but to voicemail rather than a person. */
    case VOICEMAIL = 'voicemail';

    /**
     * Get the human-readable label for this status.
     */
    public function label(): string
    {
        return match ($this) {
            self::COMPLETED => 'Completed',
            self::ERROR_OCCURRED => 'Error Occurred',
            self::MISSED => 'Missed',
            self::REJECTED => 'Rejected',
            self::VOICEMAIL => 'Connected · voicemail',
        };
    }

    /**
     * Get the badge colour key for UI rendering.
     */
    public function color(): string
    {
        return match ($this) {
            self::COMPLETED => 'green',
            self::ERROR_OCCURRED => 'red',
            self::MISSED => 'orange',
            self::REJECTED => 'volcano',
            self::VOICEMAIL => 'blue',
        };
    }
}
