<?php

namespace App\Services;

use App\Enums\DealActivityType;
use App\Models\Deal;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\DealActivityNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

/**
 * Centralized service for handling deal-related notifications.
 * 
 * This service is the single point of control for all deal activity notifications.
 * It handles:
 * - Determining who should be notified (agent + watchers)
 * - Excluding the user who made the change
 * - Sending notifications via the appropriate channels
 * 
 * Usage:
 *   app(DealNotificationService::class)->notifyDealActivity(
 *       $deal,
 *       DealActivityType::NOTE_ADDED,
 *       ['note_title' => $note->title],
 *       $excludeUserId // optional, defaults to current user
 *   );
 */
class DealNotificationService
{
    /**
     * Send notifications for a deal activity.
     *
     * @param Deal $deal The deal that was affected
     * @param DealActivityType $activityType The type of activity that occurred
     * @param array $additionalData Additional context data for the notification
     * @param int|null $excludeUserId User ID to exclude from notifications (defaults to current user)
     * @return void
     */
    public function notifyDealActivity(
        Deal $deal,
        DealActivityType $activityType,
        array $additionalData = [],
        ?int $excludeUserId = null
    ): void {
        // Get the user to exclude (the one who made the change)
        $excludeUserId = $excludeUserId ?? (user()?->id);

        // Get all users who should be notified
        $notifiableUsers = $this->getNotifiableUsers($deal, $excludeUserId);

        if ($notifiableUsers->isEmpty()) {
            return;
        }

        // Build the notification data
        $notificationData = $this->buildNotificationData($deal, $activityType, $additionalData, $excludeUserId);

        // Send the notification
        $notification = new DealActivityNotification($deal, $activityType, $notificationData);
        Notification::send($notifiableUsers, BaseNotification::applySuppressionFromContainer($notification));
    }

    /**
     * Get all users who should be notified for a deal activity.
     * This includes the assigned agent and all watchers, excluding the specified user.
     *
     * @param Deal $deal
     * @param int|null $excludeUserId
     * @return Collection<User>
     */
    public function getNotifiableUsers(Deal $deal, ?int $excludeUserId = null): Collection
    {
        $userIds = collect();

        // Load relationships if not already loaded
        $deal->loadMissing(['leadAgent.user', 'dealWatchers', 'dealParticipants']);

        // Add the assigned agent's user ID
        if ($deal->leadAgent && $deal->leadAgent->user_id) {
            $userIds->push($deal->leadAgent->user_id);
        }

        // Participants receive every notification the agent does — same access, same visibility.
        if ($deal->dealParticipants && $deal->dealParticipants->isNotEmpty()) {
            $userIds = $userIds->merge($deal->dealParticipants->pluck('id')->toArray());
        }

        // Add all watcher user IDs
        if ($deal->dealWatchers && $deal->dealWatchers->isNotEmpty()) {
            $watcherIds = $deal->dealWatchers->pluck('id')->toArray();
            $userIds = $userIds->merge($watcherIds);
        }

        // Remove duplicates and the excluded user
        $userIds = $userIds->unique()->filter(function ($userId) use ($excludeUserId) {
            return $userId !== $excludeUserId && $userId !== null;
        });

        if ($userIds->isEmpty()) {
            return collect();
        }

        // Fetch the actual User models with email_notifications check
        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * Build the notification data array.
     *
     * @param Deal $deal
     * @param DealActivityType $activityType
     * @param array $additionalData
     * @param int|null $triggeredByUserId
     * @return array
     */
    protected function buildNotificationData(
        Deal $deal,
        DealActivityType $activityType,
        array $additionalData,
        ?int $triggeredByUserId
    ): array {
        // Get the user who triggered the action
        $triggeredBy = $triggeredByUserId 
            ? User::find($triggeredByUserId) 
            : user();

        return array_merge([
            'deal_id' => $deal->id,
            'deal_name' => $deal->name,
            'activity_type' => $activityType->value,
            'activity_label' => $activityType->label(),
            'activity_icon' => $activityType->icon(),
            'triggered_by_id' => $triggeredBy?->id,
            'triggered_by_name' => $triggeredBy?->name ?? 'System',
            'contact_name' => $deal->contact?->client_name ?? null,
            'company_id' => $deal->company_id,
        ], $additionalData);
    }

    /**
     * Notify about a note being added to a deal.
     *
     * @param Deal $deal
     * @param string $noteTitle
     * @param int|null $noteId
     * @return void
     */
    public function notifyNoteAdded(Deal $deal, string $noteTitle, ?int $noteId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::NOTE_ADDED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ]);
    }

    /**
     * Notify about a note being updated.
     *
     * @param Deal $deal
     * @param string $noteTitle
     * @param int|null $noteId
     * @return void
     */
    public function notifyNoteUpdated(Deal $deal, string $noteTitle, ?int $noteId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::NOTE_UPDATED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ]);
    }

    /**
     * Notify about a stage change.
     *
     * @param Deal $deal
     * @param string|null $fromStage
     * @param string|null $toStage
     * @return void
     */
    public function notifyStageChanged(Deal $deal, ?string $fromStage, ?string $toStage): void
    {
        $this->notifyDealActivity($deal, DealActivityType::STAGE_CHANGED, [
            'from_stage' => $fromStage,
            'to_stage' => $toStage,
        ]);
    }

    /**
     * Notify about a task being added to a deal.
     *
     * @param Deal $deal
     * @param string $taskHeading
     * @param int|null $taskId
     * @return void
     */
    public function notifyTaskAdded(Deal $deal, string $taskHeading, ?int $taskId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::TASK_ADDED, [
            'task_heading' => $taskHeading,
            'task_id' => $taskId,
        ]);
    }

    /**
     * Notify about a task being updated.
     *
     * @param Deal $deal
     * @param string $taskHeading
     * @param int|null $taskId
     * @return void
     */
    public function notifyTaskUpdated(Deal $deal, string $taskHeading, ?int $taskId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::TASK_UPDATED, [
            'task_heading' => $taskHeading,
            'task_id' => $taskId,
        ]);
    }

    /**
     * Notify about a task being completed.
     *
     * @param Deal $deal
     * @param string $taskHeading
     * @param int|null $taskId
     * @return void
     */
    public function notifyTaskCompleted(Deal $deal, string $taskHeading, ?int $taskId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::TASK_COMPLETED, [
            'task_heading' => $taskHeading,
            'task_id' => $taskId,
        ]);
    }

    /**
     * Notify about a meeting being scheduled.
     *
     * @param Deal $deal
     * @param string $meetingRemark
     * @param string|null $meetingDate
     * @param int|null $followUpId
     * @return void
     */
    public function notifyMeetingScheduled(Deal $deal, string $meetingRemark, ?string $meetingDate = null, ?int $followUpId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::MEETING_SCHEDULED, [
            'meeting_remark' => $meetingRemark,
            'meeting_date' => $meetingDate,
            'follow_up_id' => $followUpId,
        ]);
    }

    /**
     * Notify about a meeting being updated.
     *
     * @param Deal $deal
     * @param string $meetingRemark
     * @param string|null $meetingDate
     * @param int|null $followUpId
     * @return void
     */
    public function notifyMeetingUpdated(Deal $deal, string $meetingRemark, ?string $meetingDate = null, ?int $followUpId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => $meetingRemark,
            'meeting_date' => $meetingDate,
            'follow_up_id' => $followUpId,
        ]);
    }

    /**
     * Notify about a file being uploaded.
     *
     * @param Deal $deal
     * @param string $fileName
     * @param int|null $fileId
     * @return void
     */
    public function notifyFileUploaded(Deal $deal, string $fileName, ?int $fileId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::FILE_UPLOADED, [
            'file_name' => $fileName,
            'file_id' => $fileId,
        ]);
    }

    /**
     * Notify about a file being deleted.
     *
     * @param Deal $deal
     * @param string $fileName
     * @return void
     */
    public function notifyFileDeleted(Deal $deal, string $fileName): void
    {
        $this->notifyDealActivity($deal, DealActivityType::FILE_DELETED, [
            'file_name' => $fileName,
        ]);
    }

    /**
     * Notify about a property being linked to a deal.
     *
     * @param Deal $deal
     * @param string $propertyTitle
     * @param int|null $propertyId
     * @return void
     */
    public function notifyPropertyLinked(Deal $deal, string $propertyTitle, ?int $propertyId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PROPERTY_LINKED, [
            'property_title' => $propertyTitle,
            'property_id' => $propertyId,
        ]);
    }

    /**
     * Notify about a property being unlinked from a deal.
     *
     * @param Deal $deal
     * @param string $propertyTitle
     * @param int|null $propertyId
     * @return void
     */
    public function notifyPropertyUnlinked(Deal $deal, string $propertyTitle, ?int $propertyId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PROPERTY_UNLINKED, [
            'property_title' => $propertyTitle,
            'property_id' => $propertyId,
        ]);
    }

    /**
     * Notify about a package being assigned to a deal.
     *
     * @param Deal $deal
     * @param array $packageNames Array of package names
     * @return void
     */
    public function notifyPackageAssigned(Deal $deal, array $packageNames): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PACKAGE_ASSIGNED, [
            'package_names' => $packageNames,
            'package_count' => count($packageNames),
        ]);
    }

    /**
     * Notify about a package being removed from a deal.
     *
     * @param Deal $deal
     * @param array $packageNames Array of package names
     * @return void
     */
    public function notifyPackageRemoved(Deal $deal, array $packageNames): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PACKAGE_REMOVED, [
            'package_names' => $packageNames,
            'package_count' => count($packageNames),
        ]);
    }
}
