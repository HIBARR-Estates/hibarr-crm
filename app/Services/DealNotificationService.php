<?php

namespace App\Services;

use App\Enums\DealActivityType;
use App\Models\Deal;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\DealActivityNotification;
use App\Notifications\DealCloseDateApproaching;
use App\Notifications\DealDeleted;
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
     * @param  Deal  $deal  The deal that was affected
     * @param  DealActivityType  $activityType  The type of activity that occurred
     * @param  array  $additionalData  Additional context data for the notification
     * @param  int|null  $excludeUserId  User ID to exclude from notifications (defaults to current user)
     */
    public function notifyDealActivity(
        Deal $deal,
        DealActivityType $activityType,
        array $additionalData = [],
        ?int $excludeUserId = null,
        array $additionalExcludeUserIds = [],
        ?Collection $recipients = null,
    ): void {
        // Get the user to exclude (the one who made the change)
        $excludeUserId = $excludeUserId ?? (user()?->id);

        // Get all users who should be notified
        $notifiableUsers = $recipients ?? $this->getNotifiableUsers($deal, $excludeUserId, $additionalExcludeUserIds);

        if ($notifiableUsers->isEmpty()) {
            return;
        }

        $this->sendActivityNotification($deal, $activityType, $additionalData, $notifiableUsers, $excludeUserId);
    }

    /**
     * @param  Collection<User>  $notifiableUsers
     */
    protected function sendActivityNotification(
        Deal $deal,
        DealActivityType $activityType,
        array $additionalData,
        Collection $notifiableUsers,
        ?int $triggeredByUserId = null,
    ): void {
        $notificationData = $this->buildNotificationData($deal, $activityType, $additionalData, $triggeredByUserId);

        $notification = new DealActivityNotification($deal, $activityType, $notificationData);
        Notification::send($notifiableUsers, BaseNotification::applySuppressionFromContainer($notification));
    }

    /**
     * Get all users who should be notified for a deal activity.
     * This includes the assigned agent and all watchers, excluding the specified user.
     *
     * @return Collection<User>
     */
    public function getNotifiableUsers(Deal $deal, ?int $excludeUserId = null, array $additionalExcludeUserIds = []): Collection
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

        // Remove duplicates and excluded users (int-cast: pluck may return strings)
        $excludedIds = collect($additionalExcludeUserIds)->push($excludeUserId)->filter()->unique();
        $userIds = $userIds->unique()->filter(function ($userId) use ($excludedIds) {
            if ($userId === null) {
                return false;
            }

            return ! $excludedIds->contains(fn ($excludedId) => (int) $userId === (int) $excludedId);
        });

        if ($userIds->isEmpty()) {
            return $this->activeAdminsForCompany((int) $deal->company_id, $excludeUserId, $additionalExcludeUserIds);
        }

        // Fetch the actual User models with email_notifications check
        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * Agent + manager + watchers/participants for closed-won/lost alerts.
     *
     * @return Collection<User>
     */
    public function getClosureRecipients(Deal $deal, ?int $excludeUserId = null): Collection
    {
        $deal->loadMissing(['leadAgent.user.employeeDetail.reportingTo', 'dealWatchers', 'dealParticipants']);

        $userIds = collect();

        if ($deal->leadAgent?->user_id) {
            $userIds->push((int) $deal->leadAgent->user_id);

            $manager = $deal->leadAgent->user?->employeeDetail?->reportingTo;
            if ($manager) {
                $userIds->push((int) $manager->id);
            }
        }

        if ($deal->dealWatchers?->isNotEmpty()) {
            $userIds = $userIds->merge($deal->dealWatchers->pluck('id'));
        }

        if ($deal->dealParticipants?->isNotEmpty()) {
            $userIds = $userIds->merge($deal->dealParticipants->pluck('id'));
        }

        $excludedIds = collect([$excludeUserId])->filter()->unique();
        $userIds = $userIds->unique()->filter(fn ($id) => $id && ! $excludedIds->contains($id));

        if ($userIds->isEmpty()) {
            return $this->activeAdminsForCompany((int) $deal->company_id, $excludeUserId);
        }

        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * Assigned agent + their manager; falls back to admins when unassigned.
     *
     * @return Collection<User>
     */
    public function getAgentAndManagerRecipients(Deal $deal, ?int $excludeUserId = null): Collection
    {
        $deal->loadMissing(['leadAgent.user.employeeDetail.reportingTo']);

        $userIds = collect();

        if ($deal->leadAgent?->user_id) {
            $userIds->push((int) $deal->leadAgent->user_id);

            $manager = $deal->leadAgent->user?->employeeDetail?->reportingTo;
            if ($manager) {
                $userIds->push((int) $manager->id);
            }
        }

        $excludedIds = collect([$excludeUserId])->filter()->unique();
        $userIds = $userIds->unique()->filter(fn ($id) => $id && ! $excludedIds->contains($id));

        if ($userIds->isEmpty()) {
            return $this->activeAdminsForCompany((int) $deal->company_id, $excludeUserId);
        }

        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * Agent + watchers; falls back to admins when nobody is assigned.
     *
     * @return Collection<User>
     */
    public function getAgentAndWatcherRecipients(Deal $deal, ?int $excludeUserId = null): Collection
    {
        $deal->loadMissing(['leadAgent.user', 'dealWatchers']);

        $userIds = collect();

        if ($deal->leadAgent?->user_id) {
            $userIds->push((int) $deal->leadAgent->user_id);
        }

        if ($deal->dealWatchers?->isNotEmpty()) {
            $userIds = $userIds->merge($deal->dealWatchers->pluck('id'));
        }

        $excludedIds = collect([$excludeUserId])->filter()->unique();
        $userIds = $userIds->unique()->filter(fn ($id) => $id && ! $excludedIds->contains($id));

        if ($userIds->isEmpty()) {
            return $this->activeAdminsForCompany((int) $deal->company_id, $excludeUserId);
        }

        return User::whereIn('id', $userIds->toArray())
            ->where('status', 'active')
            ->get();
    }

    /**
     * @return Collection<User>
     */
    protected function activeAdminsForCompany(
        int $companyId,
        ?int $excludeUserId = null,
        array $additionalExcludeUserIds = [],
    ): Collection {
        $excludedIds = collect($additionalExcludeUserIds)->push($excludeUserId)->filter()->unique();

        return User::allAdmins($companyId)
            ->filter(fn (User $user) => $user->status === 'active' && ! $excludedIds->contains($user->id))
            ->values();
    }

    /**
     * Build the notification data array.
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
     */
    public function notifyNoteUpdated(Deal $deal, string $noteTitle, ?int $noteId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::NOTE_UPDATED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ]);
    }

    /**
     * Notify about a note being deleted from a deal.
     */
    public function notifyNoteDeleted(Deal $deal, string $noteTitle, ?int $noteId = null): void
    {
        $this->notifyDealActivity($deal, DealActivityType::NOTE_DELETED, [
            'note_title' => $noteTitle,
            'note_id' => $noteId,
        ]);
    }

    /**
     * Notify about a stage change.
     */
    public function notifyStageChanged(Deal $deal, ?string $fromStage, ?string $toStage): void
    {
        $this->notifyDealActivity($deal, DealActivityType::STAGE_CHANGED, [
            'from_stage' => $fromStage,
            'to_stage' => $toStage,
        ]);
    }

    /**
     * Notify about a pipeline change.
     */
    public function notifyPipelineChanged(Deal $deal, ?string $fromPipeline, ?string $toPipeline): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PIPELINE_CHANGED, [
            'from_pipeline' => $fromPipeline,
            'to_pipeline' => $toPipeline,
        ]);
    }

    /**
     * Notify stakeholders that a deal was marked won.
     */
    public function notifyDealWon(Deal $deal): void
    {
        $recipients = $this->getClosureRecipients($deal, user()?->id);
        $this->notifyDealActivity(
            $deal,
            DealActivityType::DEAL_WON,
            ['outcome' => 'won'],
            user()?->id,
            [],
            $recipients,
        );
    }

    /**
     * Notify stakeholders that a deal was marked lost.
     */
    public function notifyDealLost(Deal $deal): void
    {
        $recipients = $this->getClosureRecipients($deal, user()?->id);
        $this->notifyDealActivity(
            $deal,
            DealActivityType::DEAL_LOST,
            ['outcome' => 'lost'],
            user()?->id,
            [],
            $recipients,
        );
    }

    /**
     * Notify that a deal's close date is approaching.
     */
    public function notifyCloseDateApproaching(Deal $deal): void
    {
        if (! $deal->close_date) {
            return;
        }

        $recipients = $this->getAgentAndManagerRecipients($deal);
        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, BaseNotification::applySuppressionFromContainer(new DealCloseDateApproaching($deal)));
    }

    /**
     * Notify agent/watchers when a deal is removed.
     */
    public function notifyDealDeleted(Deal $deal, ?User $deletedBy = null): void
    {
        if (isRunningInConsoleOrSeeding()) {
            return;
        }

        $recipients = $this->getAgentAndWatcherRecipients($deal, $deletedBy?->id)
            ->filter(fn (User $user) => (int) $user->id !== (int) ($deletedBy?->id));

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, BaseNotification::applySuppressionFromContainer(new DealDeleted($deal, $deletedBy)));
    }

    /**
     * Open deals with close_date inside the reminder window.
     *
     * @return \Illuminate\Support\LazyCollection<int, Deal>
     */
    public function dealsWithApproachingCloseDateForCompany(int $companyId, ?\Carbon\Carbon $now = null): \Illuminate\Support\LazyCollection
    {
        $company = \App\Models\Company::find($companyId);
        $now = $now ?? now($company?->timezone ?: 'UTC');
        $windowDays = max(1, (int) config('deals.close_date_reminder_days', 3));
        $windowEnd = $now->copy()->endOfDay()->addDays($windowDays);

        return Deal::query()
            ->with(['leadAgent.user.employeeDetail.reportingTo', 'dealWatchers', 'company'])
            ->where('company_id', $companyId)
            ->whereNotNull('close_date')
            ->where('close_date', '>=', $now->copy()->startOfDay())
            ->where('close_date', '<=', $windowEnd)
            ->where(function ($query) {
                $query->whereNull('outcome_status')
                    ->orWhereNotIn('outcome_status', [
                        \App\Enums\OutcomeStatus::Won->value,
                        \App\Enums\OutcomeStatus::Lost->value,
                    ]);
            })
            ->whereDoesntHave('leadStage', fn ($stageQuery) => $stageQuery->whereIn('slug', ['win', 'lost']))
            ->cursor();
    }

    /**
     * Notify about the deal's agent being changed (reassignment, not first assignment).
     * The newly-assigned agent is excluded — they already receive a dedicated
     * LeadAgentAssigned notification, so this only reaches other watchers/participants.
     */
    public function notifyAgentChanged(Deal $deal, ?string $fromAgentName, ?string $toAgentName, ?int $newAgentUserId = null): void
    {
        $this->notifyDealActivity(
            $deal,
            DealActivityType::AGENT_CHANGED,
            [
                'from_agent_name' => $fromAgentName,
                'to_agent_name' => $toAgentName,
            ],
            null,
            $newAgentUserId ? [$newAgentUserId] : []
        );
    }

    /**
     * Notify about watchers being added to / removed from a deal.
     * Each watcher only hears about the change that actually affects them.
     */
    public function notifyWatchersChanged(Deal $deal, array $oldWatcherIds, array $newWatcherIds): void
    {
        $excludeUserId = user()?->id;
        $addedIds = array_diff($newWatcherIds, $oldWatcherIds);
        $removedIds = array_diff($oldWatcherIds, $newWatcherIds);

        if ($excludeUserId) {
            $addedIds = array_diff($addedIds, [$excludeUserId]);
            $removedIds = array_diff($removedIds, [$excludeUserId]);
        }

        if (! empty($addedIds)) {
            $added = User::whereIn('id', $addedIds)->where('status', 'active')->get();
            if ($added->isNotEmpty()) {
                $this->notifyDealActivity($deal, DealActivityType::WATCHER_ADDED, [], $excludeUserId, [], $added);
            }
        }

        if (! empty($removedIds)) {
            $removed = User::whereIn('id', $removedIds)->where('status', 'active')->get();
            if ($removed->isNotEmpty()) {
                $this->notifyDealActivity($deal, DealActivityType::WATCHER_REMOVED, [], $excludeUserId, [], $removed);
            }
        }
    }

    /**
     * Notify about a task being added to a deal.
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
     */
    public function notifyMeetingScheduled(
        Deal $deal,
        string $meetingRemark,
        ?string $meetingDate = null,
        ?int $followUpId = null,
        ?int $excludeUserId = null,
    ): void {
        $this->notifyDealActivity($deal, DealActivityType::MEETING_SCHEDULED, [
            'meeting_remark' => $meetingRemark,
            'meeting_date' => $meetingDate,
            'follow_up_id' => $followUpId,
        ], $excludeUserId);
    }

    /**
     * Notify about a meeting being updated.
     */
    public function notifyMeetingUpdated(
        Deal $deal,
        string $meetingRemark,
        ?string $meetingDate = null,
        ?int $followUpId = null,
        ?int $excludeUserId = null,
    ): void {
        $this->notifyDealActivity($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => $meetingRemark,
            'meeting_date' => $meetingDate,
            'follow_up_id' => $followUpId,
        ], $excludeUserId);
    }

    /**
     * Notify about a meeting being cancelled or removed.
     */
    public function notifyMeetingCancelled(
        Deal $deal,
        string $meetingRemark,
        ?string $meetingDate = null,
        ?int $followUpId = null,
        ?int $excludeUserId = null,
    ): void {
        $this->notifyDealActivity($deal, DealActivityType::MEETING_CANCELLED, [
            'meeting_remark' => $meetingRemark,
            'meeting_date' => $meetingDate,
            'follow_up_id' => $followUpId,
        ], $excludeUserId);
    }

    /**
     * Notify about a file being uploaded.
     *
     * @param  ?string  $fieldLabel  Custom-field label when the upload targets a field; omit for deal file-tab uploads.
     */
    public function notifyFileUploaded(Deal $deal, ?int $fileId = null, ?string $fieldLabel = null): void
    {
        $payload = ['file_id' => $fileId];
        if ($fieldLabel !== null && $fieldLabel !== '') {
            $payload['field_label'] = $fieldLabel;
        }

        $this->notifyDealActivity($deal, DealActivityType::FILE_UPLOADED, $payload);
    }

    /**
     * Notify about a file metadata update on a deal.
     */
    public function notifyFileUpdated(Deal $deal, ?int $fileId = null, ?string $fieldLabel = null): void
    {
        $payload = ['file_id' => $fileId];
        if ($fieldLabel !== null && $fieldLabel !== '') {
            $payload['field_label'] = $fieldLabel;
        }

        $this->notifyDealActivity($deal, DealActivityType::FILE_UPDATED, $payload);
    }

    /**
     * Notify about a file being deleted.
     */
    public function notifyFileDeleted(Deal $deal, ?int $fileId = null, ?string $fieldLabel = null): void
    {
        $payload = ['file_id' => $fileId];
        if ($fieldLabel !== null && $fieldLabel !== '') {
            $payload['field_label'] = $fieldLabel;
        }

        $this->notifyDealActivity($deal, DealActivityType::FILE_DELETED, $payload);
    }

    /**
     * Notify about a property being linked to a deal.
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
     * @param  array  $packageNames  Array of package names
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
     * @param  array  $packageNames  Array of package names
     */
    public function notifyPackageRemoved(Deal $deal, array $packageNames): void
    {
        $this->notifyDealActivity($deal, DealActivityType::PACKAGE_REMOVED, [
            'package_names' => $packageNames,
            'package_count' => count($packageNames),
        ]);
    }
}
