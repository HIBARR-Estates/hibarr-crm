<?php

namespace App\Observers;

use App\Models\Property;
use App\Models\PropertyAsset;
use App\Services\PropertyNotificationService;

class PropertyAssetObserver
{
    public function __construct(
        protected PropertyNotificationService $notificationService,
    ) {}

    public function created(PropertyAsset $asset): void
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $property = Property::find($asset->property_id);
        if (! $property) {
            return;
        }

        $this->notificationService->notifyDocumentUploaded(
            $property,
            $asset->name ?? 'Document',
            $asset->id,
        );
    }
}
