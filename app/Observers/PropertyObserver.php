<?php

namespace App\Observers;

use App\Models\Property;
use App\Services\PropertyNotificationService;

class PropertyObserver
{
    public function __construct(
        protected PropertyNotificationService $notificationService,
    ) {}

    public function created(Property $property): void
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $this->notificationService->notifyCreated($property);
    }

    public function updated(Property $property): void
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        if ($property->wasChanged('is_published')) {
            if ($property->is_published) {
                $this->notificationService->notifyPublished($property);
            } else {
                $this->notificationService->notifyUnpublished($property);
            }
        }

        if ($property->wasChanged('status')) {
            $this->notificationService->notifyStatusChanged(
                $property,
                $property->getOriginal('status'),
            );
        }

        if ($property->wasChanged('price')) {
            $this->notificationService->notifyPriceChanged(
                $property,
                $property->getOriginal('price'),
            );
        }

        if ($property->wasChanged('responsible_agent_id')) {
            $newAgentId = (int) $property->responsible_agent_id;
            if ($newAgentId > 0) {
                $this->notificationService->notifyAgentAssigned($property, $newAgentId);
            }
        }
    }

    public function deleting(Property $property): void
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $this->notificationService->notifyArchived($property);
    }
}
