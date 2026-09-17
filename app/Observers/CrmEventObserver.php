<?php

namespace App\Observers;

use App\Jobs\DispatchOlWebhookJob;
use App\Models\CrmEvent;
use App\Models\OlWebhookDelivery;
use App\Support\FeatureFlags;

class CrmEventObserver
{
    public function created(CrmEvent $event): void
    {
        if (! FeatureFlags::enabled('sales.crm-lead-deal-sync')) {
            return;
        }

        if (! (bool) config('services.ol_webhook.enabled', false)) {
            return;
        }

        if ((string) config('services.ol_webhook.endpoint', '') === '') {
            return;
        }

        $event->loadMissing('eventType');
        $slug = $event->eventType?->slug;

        if (! $slug) {
            return;
        }

        $allowedSlugs = config('crm_events.ol_webhook.event_slugs', []);
        if (! in_array($slug, $allowedSlugs, true)) {
            return;
        }

        // Created eagerly (before the job even runs) so a stuck/lost queue
        // job still leaves a visible "pending" row instead of nothing.
        OlWebhookDelivery::create([
            'crm_event_id' => $event->id,
            'crm_event_uuid' => $event->uuid,
            'event_type_slug' => $slug,
            'model_type' => $event->model_type,
            'model_id' => $event->model_id,
            'company_id' => $event->company_id,
            'origin' => data_get($event->metadata, 'origin', OlWebhookDelivery::ORIGIN_OBSERVER),
        ]);

        DispatchOlWebhookJob::dispatch($event->id);
    }
}
