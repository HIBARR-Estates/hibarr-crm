<?php

namespace Tests\Feature\Analytics;

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Support\Facades\Config;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The switch that decides whether analytics runs at all.
 *
 * The frontend treats a null `posthog` prop as "never load the library", so
 * this one method is the difference between an environment that reports usage
 * to a third party and one that does not. Worth a test precisely because it is
 * small enough to look obviously correct while being wrong.
 */
class PostHogConfigTest extends TestCase
{
    public function test_analytics_is_disabled_when_no_key_is_configured(): void
    {
        Config::set('services.posthog.key', null);
        Config::set('services.posthog.host', 'https://eu.i.posthog.com');

        // Null, not an array with an empty key: the frontend has one thing to
        // check, and an unconfigured environment never loads posthog-js.
        $this->assertNull($this->resolveConfig());
    }

    public function test_an_empty_key_is_treated_as_disabled(): void
    {
        // Infisical and .env both hand back "" rather than null for a declared
        // but unset secret, which is the realistic shape of "not configured".
        Config::set('services.posthog.key', '');

        $this->assertNull($this->resolveConfig());
    }

    public function test_the_key_and_host_reach_the_frontend_once_configured(): void
    {
        Config::set('services.posthog.key', 'phc_test_key');
        Config::set('services.posthog.host', 'https://eu.i.posthog.com');

        $this->assertSame([
            'key' => 'phc_test_key',
            'host' => 'https://eu.i.posthog.com',
        ], $this->resolveConfig());
    }

    public function test_the_shared_payload_is_only_the_key_and_host(): void
    {
        Config::set('services.posthog.key', 'phc_test_key');

        // User identity reaches PostHog from the `auth.user` prop that every
        // page already shares, never from here. Pinning the exact keys keeps
        // this prop from quietly growing a second, divergent copy of the user —
        // which is how the CRM would end up with two answers to "what did we
        // send about this person" when a deletion request arrives.
        $this->assertSame(['key', 'host'], array_keys($this->resolveConfig()));
    }

    private function resolveConfig(): ?array
    {
        $method = new ReflectionMethod(HandleInertiaRequests::class, 'getPostHogConfig');
        $method->setAccessible(true);

        return $method->invoke(app(HandleInertiaRequests::class));
    }
}
