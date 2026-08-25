<?php

namespace App\Support;

/**
 * Normalizes meeting location/platform values for join-link and ICS behavior.
 * Keep in sync with resources/js/Components/Redesign/meeting/meetingFormUtils.ts
 */
class MeetingLocation
{
    /** @var list<string> */
    public const NON_VIDEO_LOCATIONS = ['office', 'phone', 'physical'];

    /** @var list<string> */
    public const VIDEO_LOCATIONS = [
        'zoom',
        'zoho',
        'zoho_meet',
        'google_meet',
        'teams',
        'meet',
        'skype',
        'other',
    ];

    /**
     * Whether a join URL should be surfaced in emails / ICS for this location.
     * Free-text physical addresses (not in VIDEO_LOCATIONS) return false.
     * Empty location keeps backward compatibility for legacy rows that only store meeting_link.
     */
    public static function supportsJoinLink(?string $location): bool
    {
        $location = strtolower(trim((string) $location));

        if ($location === '') {
            return true;
        }

        if (in_array($location, self::NON_VIDEO_LOCATIONS, true)) {
            return false;
        }

        return in_array($location, self::VIDEO_LOCATIONS, true);
    }
}
