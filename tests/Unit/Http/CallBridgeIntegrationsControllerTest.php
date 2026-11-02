<?php

namespace Tests\Unit\Http;

use App\Http\Controllers\Api\CallBridgeIntegrationsController;
use Illuminate\Http\Request;
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
}
