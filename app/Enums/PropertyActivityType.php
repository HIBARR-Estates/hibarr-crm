<?php

namespace App\Enums;

/**
 * Trackable property lifecycle activity types for notifications.
 */
enum PropertyActivityType: string
{
    case CREATED = 'created';
    case PUBLISHED = 'published';
    case UNPUBLISHED = 'unpublished';
    case STATUS_CHANGED = 'status_changed';
    case PRICE_CHANGED = 'price_changed';
    case AGENT_ASSIGNED = 'agent_assigned';
    case DOCUMENT_UPLOADED = 'document_uploaded';
    case ARCHIVED = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::CREATED => 'Property Created',
            self::PUBLISHED => 'Property Published',
            self::UNPUBLISHED => 'Property Unpublished',
            self::STATUS_CHANGED => 'Property Status Changed',
            self::PRICE_CHANGED => 'Property Price Changed',
            self::AGENT_ASSIGNED => 'Property Agent Assigned',
            self::DOCUMENT_UPLOADED => 'Property Document Uploaded',
            self::ARCHIVED => 'Property Archived',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::CREATED => 'property',
            self::PUBLISHED => 'property',
            self::UNPUBLISHED => 'property',
            self::STATUS_CHANGED => 'property',
            self::PRICE_CHANGED => 'property',
            self::AGENT_ASSIGNED => 'agent',
            self::DOCUMENT_UPLOADED => 'file',
            self::ARCHIVED => 'property',
        };
    }

    public function emailSettingSlug(): string
    {
        return 'property-activity-notification';
    }
}
