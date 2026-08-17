<?php

namespace App\Support;

/**
 * Tab-aware URLs for deal/lead entity pages (redesign query params).
 */
class EntityActivityNotificationUrl
{
    /**
     * Workspace tab for deal/lead activity types (notes, tasks, meetings).
     */
    public static function tabForActivityType(?string $activityType): ?string
    {
        if ($activityType === null || $activityType === '') {
            return null;
        }

        if (str_starts_with($activityType, 'note_')) {
            return 'notes';
        }

        if (str_starts_with($activityType, 'task_')) {
            return 'tasks';
        }

        if (str_starts_with($activityType, 'meeting_')) {
            return 'meetings';
        }

        return null;
    }

    public static function dealShowUrl(int $dealId, ?string $activityType = null): string
    {
        $url = route('deals.show', $dealId);
        $tab = self::tabForActivityType($activityType);

        return $tab !== null ? $url.'?tab='.$tab : $url;
    }

    public static function leadShowUrl(int $leadId, ?string $activityType = null): string
    {
        $url = route('lead-contact.show', $leadId);
        $tab = self::tabForActivityType($activityType);

        return $tab !== null ? $url.'?tab='.$tab : $url;
    }

    /**
     * Append ?tab= when missing on an existing deal/lead show URL.
     */
    public static function appendTabIfMissing(string $url, ?string $activityType): string
    {
        $tab = self::tabForActivityType($activityType);
        if ($tab === null || str_contains($url, 'tab=')) {
            return $url;
        }

        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.'tab='.$tab;
    }
}
