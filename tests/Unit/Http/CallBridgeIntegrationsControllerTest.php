<?php

namespace Tests\Unit\Http;

use App\Http\Controllers\Api\CallBridgeIntegrationsController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

use Tests\Concerns\SetsFeatureFlags;

class CallBridgeIntegrationsControllerTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setFeatureFlag('callbridge.integrations', true);

        // The local .env carries an OL_API_KEY, which would switch the
        // controller onto the (real) bridge for every test below. The
        // registry-backed tests pin the bridge as unconfigured instead.
        $this->disableBridge();
    }

    public function test_providers_returns_the_registry_platforms(): void
    {
        $response = (new CallBridgeIntegrationsController())->providers(new Request());

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            ['status' => 'success', 'data' => ['providers' => ['sipgate']]],
            $response->getData(true),
        );
    }

    public function test_platform_returns_the_connection_defaults_for_the_selected_platform(): void
    {
        $response = (new CallBridgeIntegrationsController())->platform(new Request(), 'sipgate');

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            [
                'status' => 'success',
                'data' => [
                    'wss' => 'wss://sip.sipgate.de',
                    'sipUriFormat' => 'sip:{username}@sipgate.de',
                ],
            ],
            $response->getData(true),
        );
    }

    public function test_platform_rejects_an_unknown_platform(): void
    {
        try {
            (new CallBridgeIntegrationsController())->platform(new Request(), 'twilio');
            $this->fail('Expected HttpException');
        } catch (HttpException $e) {
            $this->assertSame(400, $e->getStatusCode());
        }
    }

    public function test_providers_are_served_from_ol_when_the_bridge_is_configured(): void
    {
        $this->enableBridge();
        Http::fake([
            'https://ol.test/v1/call-bridge/integrations/providers' => Http::response([
                'status' => 'success',
                'data' => ['providers' => ['sipgate', 'twilio']],
            ]),
        ]);

        $response = (new CallBridgeIntegrationsController())->providers(new Request());

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            ['status' => 'success', 'data' => ['providers' => ['sipgate', 'twilio']]],
            $response->getData(true),
        );

        // The contract requires the call-bridge API key, never a session.
        Http::assertSent(fn ($request) => str_contains($request->url(), '/call-bridge/integrations/providers')
            && $request->hasHeader('X-Api-Key', 'test-key'));
    }

    public function test_platform_defaults_are_served_from_ol_when_the_bridge_is_configured(): void
    {
        $this->enableBridge();
        Http::fake([
            'https://ol.test/v1/call-bridge/integrations/providers/sipgate' => Http::response([
                'status' => 'success',
                'data' => [
                    'wss' => 'wss://ol.example/de',
                    'sipUriFormat' => 'sip:{username}@ol.example',
                ],
            ]),
        ]);

        $response = (new CallBridgeIntegrationsController())->platform(new Request(), 'sipgate');

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            [
                'status' => 'success',
                'data' => [
                    'wss' => 'wss://ol.example/de',
                    'sipUriFormat' => 'sip:{username}@ol.example',
                ],
            ],
            $response->getData(true),
        );

        Http::assertSent(fn ($request) => str_contains($request->url(), '/call-bridge/integrations/providers/sipgate')
            && $request->hasHeader('X-Api-Key', 'test-key'));
    }

    public function test_ol_failure_falls_back_to_the_local_registry(): void
    {
        $this->enableBridge();
        Http::fake([
            'https://ol.test/v1/call-bridge/integrations/*' => Http::response([], 500),
        ]);

        $response = (new CallBridgeIntegrationsController())->providers(new Request());

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            ['status' => 'success', 'data' => ['providers' => ['sipgate']]],
            $response->getData(true),
        );
    }

    public function test_platform_is_rejected_when_neither_ol_nor_the_registry_knows_it(): void
    {
        $this->enableBridge();
        Http::fake([
            'https://ol.test/v1/call-bridge/integrations/*' => Http::response([
                'message' => 'Invalid platform: twilio.',
            ], 400),
        ]);

        try {
            (new CallBridgeIntegrationsController())->platform(new Request(), 'twilio');
            $this->fail('Expected HttpException');
        } catch (HttpException $e) {
            $this->assertSame(400, $e->getStatusCode());
        }
    }

    private function enableBridge(): void
    {
        Config::set('services.call_bridge.base_url', 'https://ol.test/v1');
        Config::set('services.call_bridge.api_key', 'test-key');
    }

    private function disableBridge(): void
    {
        Config::set('services.call_bridge.api_key', '');
    }
}
