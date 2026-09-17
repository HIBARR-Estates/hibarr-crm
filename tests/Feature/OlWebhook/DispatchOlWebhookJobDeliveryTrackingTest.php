<?php

namespace Tests\Feature\OlWebhook;

use App\Jobs\DispatchOlWebhookJob;
use App\Models\CrmEvent;
use App\Models\CrmEventCategory;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\OlWebhookDelivery;
use App\Observers\CrmEventObserver;
use App\Services\OlWebhook\OlDeliveryDecision;
use App\Services\OlWebhook\OlPayloadMapper;
use App\Services\OlWebhook\OlWebhookClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DispatchOlWebhookJobDeliveryTrackingTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.ol_webhook.endpoint', 'https://ol.example.com/webhook');
        config()->set('services.ol_webhook.api_key', 'test-key');
    }

    private function makeEventType(string $slug, ?string $modelType): CrmEventType
    {
        $category = CrmEventCategory::withoutGlobalScopes()->create([
            'company_id' => null,
            'name' => 'Test category',
            'slug' => 'test-category-'.Str::random(8),
            'is_active' => true,
        ]);

        return CrmEventType::withoutGlobalScopes()->create([
            'company_id' => null,
            'category_id' => $category->id,
            'name' => $slug,
            'slug' => $slug,
            'model_type' => $modelType,
            'is_system' => true,
            'is_active' => true,
            'sync_processing' => true,
        ]);
    }

    private function makeCrmEvent(CrmEventType $eventType, ?string $modelType, ?int $modelId, ?int $companyId): CrmEvent
    {
        return CrmEvent::withoutGlobalScopes()->create([
            'uuid' => (string) Str::uuid(),
            'company_id' => $companyId,
            'event_type_id' => $eventType->id,
            'generation_type' => 'system_generated',
            'status' => 'completed',
            'model_type' => $modelType,
            'model_id' => $modelId,
            'source' => 'observer',
            'occurred_at' => now(),
        ]);
    }

    private function runJob(int $crmEventId): void
    {
        (new DispatchOlWebhookJob($crmEventId))->handle(
            app(OlPayloadMapper::class),
            app(OlWebhookClient::class),
            app(OlDeliveryDecision::class)
        );
    }

    public function test_successful_delivery_marks_row_sent(): void
    {
        $deal = Deal::factory()->create(['company_id' => 1]);
        $eventType = $this->makeEventType('deal_created', Deal::class);
        $event = $this->makeCrmEvent($eventType, Deal::class, $deal->id, 1);

        Http::fake(['ol.example.com/*' => Http::response(['ok' => true], 200)]);

        $this->runJob($event->id);

        $this->assertDatabaseHas('ol_webhook_deliveries', [
            'crm_event_id' => $event->id,
            'status' => OlWebhookDelivery::STATUS_SENT,
        ]);
    }

    public function test_retryable_failure_marks_row_failed_and_rethrows(): void
    {
        $deal = Deal::factory()->create(['company_id' => 1]);
        $eventType = $this->makeEventType('deal_created', Deal::class);
        $event = $this->makeCrmEvent($eventType, Deal::class, $deal->id, 1);

        Http::fake(['ol.example.com/*' => Http::response(['error' => 'boom'], 500)]);

        try {
            $this->runJob($event->id);
            $this->fail('Expected a RuntimeException for a retryable failure.');
        } catch (\RuntimeException) {
            // expected
        }

        $this->assertDatabaseHas('ol_webhook_deliveries', [
            'crm_event_id' => $event->id,
            'status' => OlWebhookDelivery::STATUS_FAILED,
        ]);
    }

    public function test_non_retryable_failure_marks_row_rejected_without_throwing(): void
    {
        // No model on the event at all — OlPayloadMapper::map() returns null
        // for this, which is the "unsupported payload" non-retryable path.
        // Deliberately avoids needing a Deal/Lead fixture for this case.
        $eventType = $this->makeEventType('some_system_event', null);
        $event = $this->makeCrmEvent($eventType, null, null, 1);

        $this->runJob($event->id);

        $this->assertDatabaseHas('ol_webhook_deliveries', [
            'crm_event_id' => $event->id,
            'status' => OlWebhookDelivery::STATUS_REJECTED,
        ]);
    }

    public function test_failed_method_marks_row_exhausted(): void
    {
        $deal = Deal::factory()->create(['company_id' => 1]);
        $eventType = $this->makeEventType('deal_created', Deal::class);
        $event = $this->makeCrmEvent($eventType, Deal::class, $deal->id, 1);

        OlWebhookDelivery::create([
            'crm_event_id' => $event->id,
            'crm_event_uuid' => $event->uuid,
            'event_type_slug' => 'deal_created',
            'model_type' => Deal::class,
            'model_id' => $deal->id,
            'company_id' => 1,
            'status' => OlWebhookDelivery::STATUS_FAILED,
        ]);

        (new DispatchOlWebhookJob($event->id))->failed(new \RuntimeException('final failure'));

        $this->assertDatabaseHas('ol_webhook_deliveries', [
            'crm_event_id' => $event->id,
            'status' => OlWebhookDelivery::STATUS_EXHAUSTED,
        ]);
    }

    public function test_observer_creates_a_pending_delivery_row_before_dispatching(): void
    {
        $this->setFeatureFlag('sales.crm-lead-deal-sync', true);
        config()->set('services.ol_webhook.enabled', true);
        config()->set('crm_events.ol_webhook.event_slugs', ['lead_created']);

        $event = new CrmEvent;
        $event->id = 42;
        $event->uuid = 'test-uuid-1234';
        $event->model_type = 'App\\Models\\Lead';
        $event->model_id = 7;
        $event->company_id = 1;
        $event->setRelation('eventType', new CrmEventType(['slug' => 'lead_created']));

        Queue::fake();

        (new CrmEventObserver)->created($event);

        Queue::assertPushed(DispatchOlWebhookJob::class);

        $this->assertDatabaseHas('ol_webhook_deliveries', [
            'crm_event_id' => 42,
            'event_type_slug' => 'lead_created',
            'model_type' => 'App\\Models\\Lead',
            'model_id' => 7,
            'origin' => OlWebhookDelivery::ORIGIN_OBSERVER,
            'status' => OlWebhookDelivery::STATUS_PENDING,
        ]);
    }

    public function test_observer_creates_no_delivery_row_when_flag_disabled(): void
    {
        $this->setFeatureFlag('sales.crm-lead-deal-sync', false);
        config()->set('services.ol_webhook.enabled', true);
        config()->set('crm_events.ol_webhook.event_slugs', ['lead_created']);

        $event = new CrmEvent;
        $event->id = 42;
        $event->setRelation('eventType', new CrmEventType(['slug' => 'lead_created']));

        Queue::fake();

        (new CrmEventObserver)->created($event);

        $this->assertDatabaseMissing('ol_webhook_deliveries', ['crm_event_id' => 42]);
    }
}
