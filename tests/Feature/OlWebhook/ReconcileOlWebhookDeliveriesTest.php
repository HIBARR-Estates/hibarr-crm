<?php

namespace Tests\Feature\OlWebhook;

use App\Models\Deal;
use App\Models\OlWebhookDelivery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ReconcileOlWebhookDeliveriesTest extends TestCase
{
    use RefreshDatabase;
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.ol_webhook.enabled', true);
        config()->set('services.ol_webhook.endpoint', 'https://ol.example.com/webhook');
        config()->set('services.ol_webhook.api_key', 'test-key');
        $this->setFeatureFlag('sales.crm-lead-deal-sync', true);
    }

    private function makeOldDeal(): Deal
    {
        $deal = Deal::factory()->create(['company_id' => 1]);
        Deal::withoutGlobalScopes()->whereKey($deal->id)->update(['created_at' => now()->subHours(2)]);

        return $deal->fresh();
    }

    private function makeDelivery(Deal $deal, string $status, string $origin = OlWebhookDelivery::ORIGIN_OBSERVER, ?\DateTimeInterface $updatedAt = null): OlWebhookDelivery
    {
        $delivery = OlWebhookDelivery::create([
            'crm_event_id' => random_int(1000, 999999),
            'crm_event_uuid' => (string) \Illuminate\Support\Str::uuid(),
            'event_type_slug' => 'deal_created',
            'model_type' => Deal::class,
            'model_id' => $deal->id,
            'company_id' => 1,
            'origin' => $origin,
            'status' => $status,
        ]);

        if ($updatedAt) {
            OlWebhookDelivery::whereKey($delivery->id)->update(['updated_at' => $updatedAt]);
        }

        return $delivery;
    }

    public function test_dry_run_lists_deal_with_only_rejected_delivery_without_emitting(): void
    {
        $deal = $this->makeOldDeal();
        $this->makeDelivery($deal, OlWebhookDelivery::STATUS_REJECTED);
        $before = OlWebhookDelivery::count();

        $this->artisan('ol-webhook:reconcile', ['--type' => 'deal', '--dry-run' => true])
            ->expectsOutputToContain("Would re-emit deal_created for App\\Models\\Deal#{$deal->id}")
            ->assertSuccessful();

        $this->assertSame($before, OlWebhookDelivery::count());
    }

    public function test_skips_deal_already_sent_or_still_in_flight(): void
    {
        $sent = $this->makeOldDeal();
        $this->makeDelivery($sent, OlWebhookDelivery::STATUS_SENT);

        $inFlight = $this->makeOldDeal();
        $this->makeDelivery($inFlight, OlWebhookDelivery::STATUS_FAILED, OlWebhookDelivery::ORIGIN_OBSERVER, now()->subMinutes(2));

        $this->artisan('ol-webhook:reconcile', ['--type' => 'deal', '--dry-run' => true])
            ->doesntExpectOutputToContain("Deal#{$sent->id}")
            ->doesntExpectOutputToContain("Deal#{$inFlight->id}")
            ->assertSuccessful();
    }

    public function test_gives_up_after_max_reconcile_attempts(): void
    {
        $deal = $this->makeOldDeal();
        $this->makeDelivery($deal, OlWebhookDelivery::STATUS_REJECTED, OlWebhookDelivery::ORIGIN_RECONCILE, now()->subHours(1));
        $this->makeDelivery($deal, OlWebhookDelivery::STATUS_REJECTED, OlWebhookDelivery::ORIGIN_RECONCILE, now()->subHours(1));

        $this->artisan('ol-webhook:reconcile', ['--type' => 'deal', '--dry-run' => true, '--max-attempts' => 2])
            ->doesntExpectOutputToContain("Would re-emit deal_created for App\\Models\\Deal#{$deal->id}")
            ->assertSuccessful();
    }

    public function test_noop_when_webhook_sync_disabled(): void
    {
        config()->set('services.ol_webhook.enabled', false);

        $this->artisan('ol-webhook:reconcile')
            ->expectsOutputToContain('disabled')
            ->assertSuccessful();
    }
}
