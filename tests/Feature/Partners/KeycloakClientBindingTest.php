<?php

namespace Tests\Feature\Partners;

use App\Contracts\KeycloakIdentityClient;
use App\Services\Keycloak\FakeOlKeycloakIdentityClient;
use App\Services\Keycloak\HttpOlKeycloakIdentityClient;
use Tests\TestCase;

/**
 * The in-memory client invents identity ids, so it must never be picked
 * outside local development and tests.
 */
class KeycloakClientBindingTest extends TestCase
{
    private function resolveIn(string $environment, string $driver): KeycloakIdentityClient
    {
        $this->app['env'] = $environment;
        config()->set('services.ol.keycloak.driver', $driver);
        $this->app->forgetInstance(KeycloakIdentityClient::class);

        return $this->app->make(KeycloakIdentityClient::class);
    }

    public function test_fake_driver_is_allowed_locally(): void
    {
        $this->assertInstanceOf(FakeOlKeycloakIdentityClient::class, $this->resolveIn('local', 'fake'));
    }

    public function test_fake_driver_is_refused_in_production(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('OL_KEYCLOAK_DRIVER=fake');

        $this->resolveIn('production', 'fake');
    }

    public function test_fake_driver_is_refused_on_staging(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->resolveIn('staging', 'fake');
    }

    public function test_http_driver_is_used_outside_tests_and_local(): void
    {
        $this->assertInstanceOf(HttpOlKeycloakIdentityClient::class, $this->resolveIn('production', 'http'));
    }
}
