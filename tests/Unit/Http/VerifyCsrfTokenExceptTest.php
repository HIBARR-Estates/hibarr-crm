<?php

namespace Tests\Unit\Http;

use App\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class VerifyCsrfTokenExceptTest extends TestCase
{
    public function test_every_exception_matches_a_registered_post_route(): void
    {
        $uris = $this->webPostUris();

        foreach ($this->except() as $pattern) {
            $matches = array_filter($uris, fn (string $uri) => Str::is($pattern, $uri));

            $this->assertNotEmpty($matches, "CSRF exception '{$pattern}' matches no web POST route");
        }
    }

    public function test_every_webhook_post_route_stays_exempt(): void
    {
        $webhooks = array_filter($this->webPostUris(), fn (string $uri) => str_contains($uri, 'webhook'));

        $this->assertNotEmpty($webhooks);

        foreach ($webhooks as $uri) {
            $exempt = collect($this->except())->contains(fn (string $pattern) => Str::is($pattern, $uri));

            $this->assertTrue($exempt, "Webhook route '{$uri}' would be rejected with 419");
        }
    }

    public function test_exceptions_are_anchored_to_a_route_prefix(): void
    {
        foreach ($this->except() as $pattern) {
            $this->assertStringStartsNotWith('*', ltrim($pattern, '/'), "CSRF exception '{$pattern}' is a leading wildcard");
        }
    }

    private function except(): array
    {
        return (fn () => $this->except)->call(app(VerifyCsrfToken::class));
    }

    /**
     * URIs of POST routes in the web group, with route parameters filled in.
     * Uses the route's own middleware list so no controller gets constructed.
     */
    private function webPostUris(): array
    {
        return collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn (Route $route) => in_array('POST', $route->methods(), true) && in_array('web', $route->middleware(), true))
            ->map(fn (Route $route) => preg_replace('/\{[^}]+\}/', 'x', $route->uri()))
            ->values()
            ->all();
    }
}
