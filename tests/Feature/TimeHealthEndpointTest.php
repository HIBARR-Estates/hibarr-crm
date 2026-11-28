<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

class TimeHealthEndpointTest extends TestCase
{
    private string $previousDefaultTimezone = 'UTC';

    private ?string $previousTz = null;

    private bool $hadTz = false;

    private ?string $previousEnvTz = null;

    private bool $hadEnvTz = false;

    private ?string $previousServerTz = null;

    private bool $hadServerTz = false;

    private ?string $previousPhpTzdataVersion = null;

    private bool $hadPhpTzdataVersion = false;

    protected function setUp(): void
    {
        parent::setUp();

        $this->previousDefaultTimezone = date_default_timezone_get();

        $tz = getenv('TZ');
        $this->hadTz = $tz !== false;
        $this->previousTz = $tz === false ? null : $tz;

        $this->hadEnvTz = array_key_exists('TZ', $_ENV);
        $this->previousEnvTz = $this->hadEnvTz ? (string) $_ENV['TZ'] : null;

        $this->hadServerTz = array_key_exists('TZ', $_SERVER);
        $this->previousServerTz = $this->hadServerTz ? (string) $_SERVER['TZ'] : null;

        $phpTzdataVersion = getenv('PHP_TZDATA_VERSION');
        $this->hadPhpTzdataVersion = $phpTzdataVersion !== false;
        $this->previousPhpTzdataVersion = $phpTzdataVersion === false ? null : $phpTzdataVersion;

        // Pin ambient time state so results do not depend on the host TZ env or distro tzdata.
        putenv('TZ=UTC');
        $_ENV['TZ'] = 'UTC';
        $_SERVER['TZ'] = 'UTC';
        date_default_timezone_set('UTC');
        putenv('PHP_TZDATA_VERSION=2025b');
    }

    protected function tearDown(): void
    {
        if ($this->hadTz && $this->previousTz !== null && $this->previousTz !== '') {
            putenv('TZ=' . $this->previousTz);
        } else {
            putenv('TZ');
        }

        if ($this->hadEnvTz) {
            $_ENV['TZ'] = $this->previousEnvTz;
        } else {
            unset($_ENV['TZ']);
        }

        if ($this->hadServerTz) {
            $_SERVER['TZ'] = $this->previousServerTz;
        } else {
            unset($_SERVER['TZ']);
        }

        if ($this->hadPhpTzdataVersion && $this->previousPhpTzdataVersion !== null) {
            putenv('PHP_TZDATA_VERSION=' . $this->previousPhpTzdataVersion);
        } else {
            putenv('PHP_TZDATA_VERSION');
        }

        date_default_timezone_set($this->previousDefaultTimezone);

        parent::tearDown();
    }

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

    public function test_artisan_time_check_alignment_command_succeeds_in_strict_mode_when_healthy(): void
    {
        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $this->artisan('time:check-alignment', [
            '--no-publish' => true,
            '--json' => true,
            '--strict' => true,
        ])->assertSuccessful();
    }

    public function test_artisan_time_check_alignment_command_fails_in_strict_mode_when_unhealthy(): void
    {
        config([
            'app.timezone' => 'Europe/Istanbul',
            'app.cron_timezone' => 'UTC',
        ]);

        $this->artisan('time:check-alignment', [
            '--no-publish' => true,
            '--json' => true,
            '--strict' => true,
        ])->assertFailed();
    }

    public function test_health_time_endpoint_exposes_detailed_diagnostics_with_x_api_token_header(): void
    {
        config([
            'api.token' => 'secret-health-token',
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $response = $this->withHeaders([
            'X-API-TOKEN' => 'secret-health-token',
        ])->getJson('/api/health/time');

        $response->assertOk()
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('utc.phpDefaultTimezone', 'UTC')
            ->assertJsonPath('utc.dbSessionTimezone', 'UTC')
            ->assertJsonStructure([
                'utc' => ['phpDefaultTimezone', 'dbSessionTimezone'],
                'tzdata' => ['rawPhpTzdbVersion', 'icuTzdataVersion'],
            ]);

        $this->assertIsString($response->json('tzdata.rawPhpTzdbVersion'));
    }

    public function test_health_time_endpoint_exposes_detailed_diagnostics_with_bearer_token(): void
    {
        config([
            'api.token' => 'secret-health-token',
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $response = $this->withToken('secret-health-token')->getJson('/api/health/time');

        $response->assertOk()
            ->assertJsonPath('status', 'healthy')
            ->assertJsonPath('utc.phpDefaultTimezone', 'UTC')
            ->assertJsonPath('utc.dbSessionTimezone', 'UTC')
            ->assertJsonStructure([
                'utc' => ['phpDefaultTimezone', 'dbSessionTimezone'],
                'tzdata' => ['rawPhpTzdbVersion', 'icuTzdataVersion'],
            ]);

        $this->assertIsString($response->json('tzdata.rawPhpTzdbVersion'));
    }

    public function test_health_time_endpoint_hides_detailed_diagnostics_with_wrong_api_token(): void
    {
        config([
            'api.token' => 'secret-health-token',
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $response = $this->withHeaders([
            'X-API-TOKEN' => 'wrong-token',
        ])->getJson('/api/health/time');

        $response->assertOk()
            ->assertJsonMissingPath('utc.phpDefaultTimezone')
            ->assertJsonMissingPath('utc.dbSessionTimezone')
            ->assertJsonMissingPath('tzdata.rawPhpTzdbVersion')
            ->assertJsonMissingPath('tzdata.icuTzdataVersion');
    }
}
