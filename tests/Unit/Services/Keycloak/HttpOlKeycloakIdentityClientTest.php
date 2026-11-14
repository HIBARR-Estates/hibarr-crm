<?php

namespace Tests\Unit\Services\Keycloak;

use App\Exceptions\OlKeycloakException;
use App\Services\Keycloak\HttpOlKeycloakIdentityClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HttpOlKeycloakIdentityClientTest extends TestCase
{
    private HttpOlKeycloakIdentityClient $client;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('services.ol.base_url', 'https://ol.example.test/v1');
        config()->set('services.ol.api_key', 'test-key');
        config()->set('services.ol.timeout', 5);
        config()->set('services.ol.keycloak.paths.provision', '/internal/keycloak/users');
        config()->set('services.ol.keycloak.paths.actions_email', '/internal/keycloak/users/{keycloakUserId}/actions-email');
        config()->set('services.ol.keycloak.paths.update', '/internal/keycloak/users/{keycloakUserId}');

        $this->client = new HttpOlKeycloakIdentityClient;
    }

    public function test_provision_posts_profile_and_returns_id(): void
    {
        Http::fake([
            'https://ol.example.test/v1/internal/keycloak/users' => Http::response([
                'keycloakUserId' => 'kc-1',
                'created' => true,
            ], 200),
        ]);

        $result = $this->client->provision('Ada@Example.com', 'Ada', 'Lovelace', true);

        $this->assertSame('kc-1', $result->keycloakUserId);
        $this->assertTrue($result->created);

        Http::assertSent(function ($request) {
            return $request->url() === 'https://ol.example.test/v1/internal/keycloak/users'
                && $request->hasHeader('X-Api-Key', 'test-key')
                && $request['email'] === 'ada@example.com'
                && $request['firstName'] === 'Ada'
                && $request['sendSetupEmail'] === true;
        });
    }

    public function test_provision_treats_409_with_id_as_existing(): void
    {
        Http::fake([
            '*' => Http::response(['keycloakUserId' => 'kc-existing', 'created' => false], 409),
        ]);

        $result = $this->client->provision('ada@example.com', 'Ada', 'Lovelace');

        $this->assertSame('kc-existing', $result->keycloakUserId);
        $this->assertFalse($result->created);
    }

    public function test_provision_throws_on_502(): void
    {
        Http::fake(['*' => Http::response(['message' => 'Keycloak down'], 502)]);

        $this->expectException(OlKeycloakException::class);
        $this->client->provision('ada@example.com', 'Ada', 'Lovelace');
    }

    public function test_missing_config_throws_without_calling_network(): void
    {
        config()->set('services.ol.api_key', '');
        Http::fake();

        try {
            $this->client->provision('ada@example.com', 'Ada', 'Lovelace');
            $this->fail('Expected OlKeycloakException');
        } catch (OlKeycloakException $e) {
            $this->assertSame(503, $e->httpStatus);
        }

        Http::assertNothingSent();
    }

    public function test_actions_email_and_update_hit_templated_paths(): void
    {
        Http::fake(['*' => Http::response([], 204)]);

        $this->client->sendActionsEmail('kc-9', ['UPDATE_PASSWORD']);
        $this->client->update('kc-9', ['enabled' => false]);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/internal/keycloak/users/kc-9/actions-email'));
        Http::assertSent(fn ($request) => $request->method() === 'PATCH'
            && str_ends_with($request->url(), '/internal/keycloak/users/kc-9')
            && $request['enabled'] === false);
    }
}
