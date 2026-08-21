<?php

namespace Tests\Unit;

use App\Services\FeatureFlagService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FeatureFlagServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        app(FeatureFlagService::class)->clearTestingOverrides();
    }

    public function test_it_returns_flags_from_api_response(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.lead-qualification-tab' => true,
                        'sales.per-agent-commission-override' => false,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);

        $this->assertTrue($service->isEnabled('crm.lead-qualification-tab'));
        $this->assertFalse($service->isEnabled('sales.per-agent-commission-override'));
        $this->assertSame([
            'crm.lead-qualification-tab' => true,
            'sales.per-agent-commission-override' => false,
        ], array_intersect_key($service->all(), [
            'crm.lead-qualification-tab' => true,
            'sales.per-agent-commission-override' => true,
        ]));
    }

    public function test_missing_flag_defaults_to_false(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.deal-view-redesign' => true,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);

        $this->assertFalse($service->isEnabled('crm.lead-qualification-tab'));
        $this->assertFalse($service->forInertia()['crm.lead-qualification-tab']);
    }

    public function test_api_failure_uses_stale_cache_when_available(): void
    {
        Cache::put('feature_flags:crm:system', [
            'crm.lead-qualification-tab' => true,
            'sales.per-agent-commission-override' => true,
        ], 60);

        Http::fake([
            '*/shared/flags*' => Http::response([], 500),
        ]);

        $service = app(FeatureFlagService::class);

        $this->assertTrue($service->isEnabled('crm.lead-qualification-tab'));
        $this->assertTrue($service->isEnabled('sales.per-agent-commission-override'));
    }

    public function test_api_failure_without_cache_defaults_known_flags_to_false(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([], 500),
        ]);

        $service = app(FeatureFlagService::class);

        $this->assertFalse($service->isEnabled('crm.lead-qualification-tab'));
        $this->assertFalse($service->isEnabled('sales.per-agent-commission-override'));
        $this->assertFalse($service->forInertia()['sales.bulk-agent-promotion']);
    }

    public function test_for_inertia_returns_only_known_flags(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.lead-qualification-tab' => true,
                        'shell.websocket' => true,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);
        $inertiaFlags = $service->forInertia();

        $this->assertArrayHasKey('crm.lead-qualification-tab', $inertiaFlags);
        $this->assertArrayNotHasKey('shell.websocket', $inertiaFlags);
        $this->assertTrue($inertiaFlags['crm.lead-qualification-tab']);
    }

    public function test_deal_view_redesign_flag_is_exposed_for_inertia(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.deal-view-redesign' => true,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);
        $inertiaFlags = $service->forInertia();

        $this->assertArrayHasKey('crm.deal-view-redesign', $inertiaFlags);
        $this->assertTrue($inertiaFlags['crm.deal-view-redesign']);
    }

    public function test_lead_view_redesign_flag_is_exposed_for_inertia(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.lead-view-redesign' => true,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);
        $inertiaFlags = $service->forInertia();

        $this->assertArrayHasKey('crm.lead-view-redesign', $inertiaFlags);
        $this->assertTrue($inertiaFlags['crm.lead-view-redesign']);
    }

    public function test_lead_ai_summary_flag_is_exposed_for_inertia(): void
    {
        Http::fake([
            '*/shared/flags*' => Http::response([
                'success' => true,
                'data' => [
                    'flags' => [
                        'crm.lead-ai-summary' => true,
                    ],
                ],
            ]),
        ]);

        $service = app(FeatureFlagService::class);
        $inertiaFlags = $service->forInertia();

        $this->assertArrayHasKey('crm.lead-ai-summary', $inertiaFlags);
        $this->assertTrue($inertiaFlags['crm.lead-ai-summary']);
    }
}
