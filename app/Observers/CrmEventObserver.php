<?php

namespace App\Observers;

use App\Jobs\DispatchOlWebhookJob;
use App\Models\CrmEvent;
use App\Support\FeatureFlags;

class CrmEventObserver
{
    public function created(CrmEvent $event): void
    {
        if (!FeatureFlags::enabled('sales.crm-lead-deal-sync')) {
            return;
        }

        if (!(bool) config('services.ol_webhook.enabled', false)) {
            return;
        }

        if ((string) config('services.ol_webhook.endpoint', '') === '') {
            return;
        }

        $event->loadMissing('eventType');
        $slug = $event->eventType?->slug;

        if (!$slug) {
            return;
        }

        $allowedSlugs = config('crm_events.ol_webhook.event_slugs', []);
        if (!in_array($slug, $allowedSlugs, true)) {
            return;
        }

        DispatchOlWebhookJob::dispatch($event->id);
    }
}

