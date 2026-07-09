<?php

namespace Tests\Feature\OlWebhook;

use App\Jobs\DispatchOlWebhookJob;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Observers\CrmEventObserver;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class CrmEventObserverDispatchTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_it_dispatches_webhook_job_for_supported_event_when_flag_enabled(): void
    {
        $this->setFeatureFlag('sales.crm-lead-deal-sync', true);
        config()->set('services.ol_webhook.enabled', true);
        config()->set('services.ol_webhook.endpoint', 'https://example.com/webhook');
        config()->set('crm_events.ol_webhook.event_slugs', ['lead_created']);

        $event = new CrmEvent();
        $event->id = 42;
        $event->setRelation('eventType', new CrmEventType(['slug' => 'lead_created']));

        Queue::fake();

        (new CrmEventObserver())->created($event);

        Queue::assertPushed(DispatchOlWebhookJob::class);
    }

    public function test_it_skips_dispatch_when_flag_disabled(): void
    {
        $this->setFeatureFlag('sales.crm-lead-deal-sync', false);
        config()->set('services.ol_webhook.enabled', true);
        config()->set('services.ol_webhook.endpoint', 'https://example.com/webhook');
        config()->set('crm_events.ol_webhook.event_slugs', ['lead_created']);

        $event = new CrmEvent();
        $event->id = 42;
        $event->setRelation('eventType', new CrmEventType(['slug' => 'lead_created']));

        Queue::fake();

        (new CrmEventObserver())->created($event);

        Queue::assertNothingPushed();
    }

    public function test_it_skips_dispatch_for_unsupported_event_slug(): void
    {
        $this->setFeatureFlag('sales.crm-lead-deal-sync', true);
        config()->set('services.ol_webhook.enabled', true);
        config()->set('services.ol_webhook.endpoint', 'https://example.com/webhook');
        config()->set('crm_events.ol_webhook.event_slugs', ['lead_created']);

        $event = new CrmEvent();
        $event->id = 42;
        $event->setRelation('eventType', new CrmEventType(['slug' => 'deal_closed_won']));

        Queue::fake();

        (new CrmEventObserver())->created($event);

        Queue::assertNothingPushed();
    }
}

