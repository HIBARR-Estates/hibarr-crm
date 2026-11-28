<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class TimeHealthEndpointTest extends TestCase
{
    public function test_health_time_endpoint_returns_healthy_when_utc_aligned(): void
    {
        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $response = $this->getJson('/api/health/time');

        $response->assertOk()
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('utc.compliant', true)
            ->assertJsonPath('utc.appTimezone', 'UTC')
            ->assertJsonPath('utc.cronTimezone', 'UTC')
            ->assertJsonPath('utc.utcOffsetSeconds', 0)
            ->assertJsonPath('utc.loggerTimestampUtc', true);

        $phpVersion = $response->json('tzdata.phpVersion');
        $this->assertIsString($phpVersion);
        $this->assertMatchesRegularExpression('/^\d{4}[a-z]$/', $phpVersion);
        $response->assertJsonMissingPath('utc.dbSessionTimezone');
        $response->assertJsonMissingPath('utc.phpDefaultTimezone');
        $response->assertJsonMissingPath('tzdata.rawPhpTzdbVersion');
        $response->assertJsonMissingPath('tzdata.icuTzdataVersion');

        $route = app('router')->getRoutes()->getByName('api.health.time');
        $this->assertNotNull($route);
        $this->assertContains('throttle:30,1', $route->gatherMiddleware());
    }

    public function test_health_time_endpoint_returns_503_when_timezone_not_utc(): void
    {
        config(['app.timezone' => 'Europe/Istanbul']);

        $response = $this->getJson('/api/health/time');

        $response->assertStatus(503)
            ->assertJsonPath('status', 'unhealthy')
            ->assertJsonPath('utc.compliant', false)
            ->assertJsonPath('utc.appTimezone', 'Europe/Istanbul');
    }

    public function test_artisan_time_check_alignment_command_succeeds_without_publishing(): void
    {
        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $this->artisan('time:check-alignment', [
            '--no-publish' => true,
            '--json' => true,
        ])->assertSuccessful();
    }
}
