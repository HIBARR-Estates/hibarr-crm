<?php

namespace App\Enums;

/**
 * Enum defining all trackable deal activity types for notifications.
 *
 * This is the single source of truth for deal-related notification events.
 * When adding new activity types, add them here and update the
 * DealActivityNotification class to handle the new type.
 */
enum DealActivityType: string
{
    // Notes
    case NOTE_ADDED = 'note_added';
    case NOTE_UPDATED = 'note_updated';
    case NOTE_DELETED = 'note_deleted';

    // Stage & Pipeline
    case STAGE_CHANGED = 'stage_changed';
    case PIPELINE_CHANGED = 'pipeline_changed';
    case DEAL_WON = 'deal_won';
    case DEAL_LOST = 'deal_lost';

    // Tasks
    case TASK_ADDED = 'task_added';
    case TASK_UPDATED = 'task_updated';
    case TASK_COMPLETED = 'task_completed';
    case TASK_DELETED = 'task_deleted';

    // Meetings/Follow-ups
    case MEETING_SCHEDULED = 'meeting_scheduled';
    case MEETING_UPDATED = 'meeting_updated';
    case MEETING_CANCELLED = 'meeting_cancelled';

    // Files
    case FILE_UPLOADED = 'file_uploaded';
    case FILE_UPDATED = 'file_updated';
    case FILE_DELETED = 'file_deleted';

    // Properties
    case PROPERTY_LINKED = 'property_linked';
    case PROPERTY_UNLINKED = 'property_unlinked';

    // Packages
    case PACKAGE_ASSIGNED = 'package_assigned';
    case PACKAGE_REMOVED = 'package_removed';

    // Offers
    case OFFER_APPLIED = 'offer_applied';
    case OFFER_REMOVED = 'offer_removed';

    // Agent Assignment
    case AGENT_ASSIGNED = 'agent_assigned';
    case AGENT_CHANGED = 'agent_changed';

    // Watchers
    case WATCHER_ADDED = 'watcher_added';
    case WATCHER_REMOVED = 'watcher_removed';

    /**
     * Get the human-readable label for this activity type.
     */
    public function label(): string
    {
        return match ($this) {
            self::NOTE_ADDED => 'Note Added',
            self::NOTE_UPDATED => 'Note Updated',
            self::NOTE_DELETED => 'Note Deleted',
            self::STAGE_CHANGED => 'Stage Changed',
            self::PIPELINE_CHANGED => 'Pipeline Changed',
            self::DEAL_WON => 'Deal Won',
            self::DEAL_LOST => 'Deal Lost',
            self::TASK_ADDED => 'Task Added',
            self::TASK_UPDATED => 'Task Updated',
            self::TASK_COMPLETED => 'Task Completed',
            self::TASK_DELETED => 'Task Deleted',
            self::MEETING_SCHEDULED => 'Meeting Scheduled',
            self::MEETING_UPDATED => 'Meeting Updated',
            self::MEETING_CANCELLED => 'Meeting Cancelled',
            self::FILE_UPLOADED => 'File Uploaded',
            self::FILE_UPDATED => 'File Updated',
            self::FILE_DELETED => 'File Deleted',
            self::PROPERTY_LINKED => 'Property Linked',
            self::PROPERTY_UNLINKED => 'Property Unlinked',
            self::PACKAGE_ASSIGNED => 'Package Assigned',
            self::PACKAGE_REMOVED => 'Package Removed',
            self::OFFER_APPLIED => 'Offer Applied',
            self::OFFER_REMOVED => 'Offer Removed',
            self::AGENT_ASSIGNED => 'Agent Assigned',
            self::AGENT_CHANGED => 'Agent Changed',
            self::WATCHER_ADDED => 'Watcher Added',
            self::WATCHER_REMOVED => 'Watcher Removed',
        };
    }

    /**
     * Get the icon identifier for this activity type.
     */
    public function icon(): string
    {
        return match ($this) {
            self::NOTE_ADDED, self::NOTE_UPDATED, self::NOTE_DELETED => 'note',
            self::STAGE_CHANGED, self::PIPELINE_CHANGED, self::DEAL_WON, self::DEAL_LOST => 'stage',
            self::TASK_ADDED, self::TASK_UPDATED, self::TASK_COMPLETED, self::TASK_DELETED => 'task',
            self::MEETING_SCHEDULED, self::MEETING_UPDATED, self::MEETING_CANCELLED => 'meeting',
            self::FILE_UPLOADED, self::FILE_UPDATED, self::FILE_DELETED => 'file',
            self::PROPERTY_LINKED, self::PROPERTY_UNLINKED => 'property',
            self::PACKAGE_ASSIGNED, self::PACKAGE_REMOVED => 'package',
            self::OFFER_APPLIED, self::OFFER_REMOVED => 'offer',
            self::AGENT_ASSIGNED, self::AGENT_CHANGED => 'agent',
            self::WATCHER_ADDED, self::WATCHER_REMOVED => 'watcher',
        };
    }

    /**
     * Get email settings slug for this activity type.
     * Used to check if email notifications are enabled.
     */
    public function emailSettingSlug(): string
    {
        return match ($this) {
            self::PACKAGE_ASSIGNED, self::PACKAGE_REMOVED => 'deal-package-notification',
            self::PROPERTY_LINKED, self::PROPERTY_UNLINKED => 'deal-property-notification',
            default => 'deal-activity-notification',
        };
    }
}
