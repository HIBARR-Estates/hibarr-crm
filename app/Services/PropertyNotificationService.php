<?php

namespace App\Services;

use App\Enums\PropertyActivityType;
use App\Models\Deal;
use App\Models\Property;
use App\Models\PropertyAvailabilityRequest;
use App\Models\User;
use App\Notifications\BaseNotification;
use App\Notifications\PropertyActivityNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class PropertyNotificationService
{
    public function notifyPropertyActivity(
        Property $property,
        PropertyActivityType $activityType,
        array $additionalData = [],
        ?int $excludeUserId = null,
        ?Collection $recipients = null,
    ): void {
        $excludeUserId = $excludeUserId ?? (user()?->id);
        $notifiableUsers = $recipients ?? $this->recipientsFor($property, $activityType, $excludeUserId);

        if ($notifiableUsers->isEmpty()) {
            return;
        }

        $notificationData = $this->buildNotificationData($property, $activityType, $additionalData, $excludeUserId);
        $notification = new PropertyActivityNotification($property, $activityType, $notificationData);

        Notification::send(
            $notifiableUsers,
            BaseNotification::applySuppressionFromContainer($notification),
        );
    }

    public function notifyCreated(Property $property, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::CREATED,
            [],
            $excludeUserId,
            $this->responsibleAgentAndAdmins($property, $excludeUserId),
        );
    }

    public function notifyPublished(Property $property, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::PUBLISHED,
            [],
            $excludeUserId,
            $this->responsibleAgent($property, $excludeUserId),
        );
    }

    public function notifyUnpublished(Property $property, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::UNPUBLISHED,
            [],
            $excludeUserId,
            $this->responsibleAgentAndWatchers($property, $excludeUserId),
        );
    }

    public function notifyStatusChanged(Property $property, ?string $oldStatus, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::STATUS_CHANGED,
            [
                'old_status' => $oldStatus,
                'new_status' => $property->status,
            ],
            $excludeUserId,
            $this->dealLinkedAgents($property, $excludeUserId),
        );
    }

    public function notifyPriceChanged(Property $property, mixed $oldPrice, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::PRICE_CHANGED,
            [
                'old_price' => $oldPrice,
                'new_price' => $property->price,
            ],
            $excludeUserId,
            $this->dealLinkedAgents($property, $excludeUserId),
        );
    }

    public function notifyAgentAssigned(Property $property, int $newAgentId, ?int $excludeUserId = null): void
    {
        $agent = User::find($newAgentId);

        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::AGENT_ASSIGNED,
            [
                'agent_id' => $newAgentId,
                'agent_name' => $agent?->name ?? 'Agent',
            ],
            $excludeUserId,
            $this->usersFromIds(collect([$newAgentId]), $excludeUserId),
        );
    }

    public function notifyDocumentUploaded(
        Property $property,
        string $fileName,
        ?int $fileId = null,
        ?int $excludeUserId = null,
    ): void {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::DOCUMENT_UPLOADED,
            [
                'file_name' => $fileName,
                'file_id' => $fileId,
            ],
            $excludeUserId,
            $this->responsibleAgentAndWatchers($property, $excludeUserId),
        );
    }

    /**
     * Notify newly added watchers — mirrors deal watcher-added notifications.
     * Only the users actually being added hear about it, excluding the actor.
     */
    public function notifyWatcherAdded(Property $property, array $watcherUserIds, ?int $excludeUserId = null): void
    {
        $excludeUserId = $excludeUserId ?? (user()?->id);
        $watchers = $this->usersFromIds(collect($watcherUserIds), $excludeUserId);

        if ($watchers->isEmpty()) {
            return;
        }

        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::WATCHER_ADDED,
            [],
            $excludeUserId,
            $watchers,
        );
    }

    public function notifyArchived(Property $property, ?int $excludeUserId = null): void
    {
        $this->notifyPropertyActivity(
            $property,
            PropertyActivityType::ARCHIVED,
            ['action_url' => route('properties.index')],
            $excludeUserId,
            $this->archiveRecipients($property, $excludeUserId),
        );
    }

    /**
     * @return Collection<int, User>
     */
    public function recipientsFor(
        Property $property,
        PropertyActivityType $activityType,
        ?int $excludeUserId = null,
    ): Collection {
        return match ($activityType) {
            PropertyActivityType::CREATED => $this->responsibleAgentAndAdmins($property, $excludeUserId),
            PropertyActivityType::DOCUMENT_UPLOADED => $this->responsibleAgentAndWatchers($property, $excludeUserId),
            PropertyActivityType::PUBLISHED => $this->responsibleAgent($property, $excludeUserId),
            PropertyActivityType::UNPUBLISHED => $this->responsibleAgentAndWatchers($property, $excludeUserId),
            PropertyActivityType::STATUS_CHANGED,
            PropertyActivityType::PRICE_CHANGED => $this->dealLinkedAgents($property, $excludeUserId),
            PropertyActivityType::AGENT_ASSIGNED => collect(),
            PropertyActivityType::ARCHIVED => $this->archiveRecipients($property, $excludeUserId),
            PropertyActivityType::WATCHER_ADDED => collect(),
        };
    }

    /**
     * @return Collection<int, User>
     */
    public function dealLinkedAgents(Property $property, ?int $excludeUserId = null): Collection
    {
        if (! $property->product_id) {
            return collect();
        }

        $deals = Deal::query()
            ->where('company_id', $property->company_id)
            ->whereHas('products', fn ($query) => $query->where('products.id', $property->product_id))
            ->with(['leadAgent.user', 'dealParticipants'])
            ->get();

        $userIds = collect();

        foreach ($deals as $deal) {
            if ($deal->leadAgent?->user_id) {
                $userIds->push((int) $deal->leadAgent->user_id);
            }

            if ($deal->dealParticipants?->isNotEmpty()) {
                $userIds = $userIds->merge($deal->dealParticipants->pluck('id'));
            }
        }

        return $this->usersFromIds($userIds->unique(), $excludeUserId);
    }

    /**
     * @return Collection<int, User>
     */
    protected function responsibleAgent(Property $property, ?int $excludeUserId = null): Collection
    {
        $property->loadMissing(['responsibleAgent', 'addedBy']);
        $agentId = $property->responsible_agent_id ?? $property->added_by;

        return $this->usersFromIds(collect([$agentId])->filter(), $excludeUserId);
    }

    /**
     * @return Collection<int, User>
     */
    protected function responsibleAgentAndWatchers(Property $property, ?int $excludeUserId = null): Collection
    {
        $property->loadMissing(['responsibleAgent', 'addedBy', 'watchers']);

        $userIds = collect([
            $property->responsible_agent_id ?? $property->added_by,
        ])->merge($property->watchers->pluck('id'));

        return $this->usersFromIds($userIds->filter()->unique(), $excludeUserId);
    }

    /**
     * @return Collection<int, User>
     */
    protected function responsibleAgentAndAdmins(Property $property, ?int $excludeUserId = null): Collection
    {
        $property->loadMissing(['responsibleAgent', 'addedBy']);

        $userIds = collect([
            $property->responsible_agent_id ?? $property->added_by,
        ]);

        $recipients = $this->usersFromIds($userIds->filter()->unique(), $excludeUserId);

        if ($recipients->isNotEmpty()) {
            return $recipients->merge(
                $this->activeAdminsForCompany((int) $property->company_id, $excludeUserId),
            )->unique('id')->values();
        }

        return $this->activeAdminsForCompany((int) $property->company_id, $excludeUserId);
    }

    /**
     * @return Collection<int, User>
     */
    protected function archiveRecipients(Property $property, ?int $excludeUserId = null): Collection
    {
        $availabilityAgentIds = PropertyAvailabilityRequest::query()
            ->where('property_id', $property->id)
            ->whereIn('status', [
                PropertyAvailabilityRequest::STATUS_PENDING,
                PropertyAvailabilityRequest::STATUS_APPROVED,
                PropertyAvailabilityRequest::STATUS_ESCALATED,
            ])
            ->pluck('requesting_agent_id');

        $userIds = $availabilityAgentIds->merge(
            $this->dealLinkedAgents($property)->pluck('id'),
        );

        return $this->usersFromIds($userIds->filter()->unique(), $excludeUserId);
    }

    /**
     * @param  Collection<int, int|string|null>  $userIds
     * @return Collection<int, User>
     */
    protected function usersFromIds(Collection $userIds, ?int $excludeUserId = null): Collection
    {
        $excludedIds = collect([$excludeUserId])->filter()->unique();
        $filteredIds = $userIds
            ->filter(fn ($id) => $id !== null && ! $excludedIds->contains((int) $id))
            ->unique()
            ->values()
            ->toArray();

        if ($filteredIds === []) {
            return collect();
        }

        return User::whereIn('id', $filteredIds)
            ->where('status', 'active')
            ->get();
    }

    /**
     * @return Collection<int, User>
     */
    protected function activeAdminsForCompany(int $companyId, ?int $excludeUserId = null): Collection
    {
        $excludedIds = collect([$excludeUserId])->filter()->unique();

        return User::allAdmins($companyId)
            ->filter(fn (User $user) => $user->status === 'active' && ! $excludedIds->contains($user->id))
            ->values();
    }

    protected function buildNotificationData(
        Property $property,
        PropertyActivityType $activityType,
        array $additionalData,
        ?int $triggeredByUserId,
    ): array {
        $triggeredBy = $triggeredByUserId
            ? User::find($triggeredByUserId)
            : user();

        return array_merge([
            'property_id' => $property->id,
            'property_title' => $property->display_title ?? $property->title,
            'property_reference' => $property->reference_code,
            'activity_type' => $activityType->value,
            'activity_label' => $activityType->label(),
            'activity_icon' => $activityType->icon(),
            'triggered_by_id' => $triggeredBy?->id,
            'triggered_by_name' => $triggeredBy?->name ?? 'System',
            'company_id' => $property->company_id,
        ], $additionalData);
    }
}
