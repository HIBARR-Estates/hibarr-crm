<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Services\TimeRuntimeConformanceService;
use Illuminate\Support\Facades\Redis;
use Mockery;
use Tests\TestCase;

class TimeRuntimeConformanceServiceTest extends TestCase
{
    public function test_parse_tzdata_version_normalizes_canonical_php_numeric_and_embedded_formats(): void
    {
        $service = new TimeRuntimeConformanceService();

        $this->assertSame('2025b', $service->parseTzdataVersion('2025b'));
        $this->assertSame('2026a', $service->parseTzdataVersion('2026A'));
        $this->assertSame('2025b', $service->parseTzdataVersion('2025.2'));
        $this->assertSame('2025a', $service->parseTzdataVersion('2025.1'));
        $this->assertSame('2024z', $service->parseTzdataVersion('2024.26'));
        $this->assertSame('2025c', $service->parseTzdataVersion('tzdata 2025c'));
        $this->assertNull($service->parseTzdataVersion('0.system'));
        $this->assertNull($service->parseTzdataVersion(''));
        $this->assertNull($service->parseTzdataVersion(null));
    }

    public function test_resolve_php_tzdata_version_honors_override_and_env_fallback(): void
    {
        $service = new TimeRuntimeConformanceService();

        $fromExplicit = $service->resolvePhpTzdataVersion('2025.2');
        $this->assertSame('2025b', $fromExplicit['version']);
        $this->assertSame('env', $fromExplicit['source']);

        putenv('PHP_TZDATA_VERSION=2026c');
        try {
            $fromEnv = $service->resolvePhpTzdataVersion();
            $this->assertSame('2026c', $fromEnv['version']);
            $this->assertSame('env', $fromEnv['source']);
        } finally {
            putenv('PHP_TZDATA_VERSION');
        }

        $fromRuntime = $service->resolvePhpTzdataVersion();
        if (preg_match('/^(\d{4}[a-z])$/i', $fromRuntime['rawPhpTzdbVersion']) === 1
            || preg_match('/\d{4}\.\d+/', $fromRuntime['rawPhpTzdbVersion']) === 1
        ) {
            $this->assertNotNull($fromRuntime['version']);
            $this->assertMatchesRegularExpression('/^\d{4}[a-z]$/', (string) $fromRuntime['version']);
        }
    }

    public function test_verify_runtime_utc_reports_compliant_and_detects_non_utc_app_timezone(): void
    {
        $service = new TimeRuntimeConformanceService();

        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $compliant = $service->verifyRuntimeUtc();
        $this->assertTrue($compliant['compliant']);
        $this->assertSame([], $compliant['issues']);
        $this->assertSame(0, $compliant['utcOffsetSeconds']);

        config(['app.timezone' => 'Europe/Berlin']);

        $nonCompliant = $service->verifyRuntimeUtc();
        $this->assertFalse($nonCompliant['compliant']);
        $this->assertNotEmpty($nonCompliant['issues']);
        $this->assertStringContainsString('Europe/Berlin', implode(' ', $nonCompliant['issues']));
    }

    public function test_publish_php_tzdata_version_writes_unprefixed_redis_key_with_ttl(): void
    {
        $service = new TimeRuntimeConformanceService();

        config([
            'app.tzdata.redis_connection' => 'tzdata',
            'app.tzdata.redis_key' => 'tzdata:version:php',
            'app.tzdata.redis_ttl_seconds' => 86400,
        ]);

        $redisConnection = Mockery::mock();
        $redisConnection->shouldReceive('setex')
            ->once()
            ->with('tzdata:version:php', 86400, '2025b')
            ->andReturn(true);

        Redis::shouldReceive('connection')
            ->once()
            ->with('tzdata')
            ->andReturn($redisConnection);

        $this->assertTrue($service->publishPhpTzdataVersion('2025b'));
    }

    public function test_verify_runtime_utc_skips_database_probe_when_disabled(): void
    {
        $service = new TimeRuntimeConformanceService();

        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);

        $report = $service->verifyRuntimeUtc(false);

        $this->assertTrue($report['compliant']);
        $this->assertNull($report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_publish_php_tzdata_version_returns_false_on_redis_failure(): void
    {
        $service = new TimeRuntimeConformanceService();

        Redis::shouldReceive('connection')
            ->once()
            ->with('tzdata')
            ->andThrow(new \RuntimeException('Redis unavailable'));

        $this->assertFalse($service->publishPhpTzdataVersion('2025b'));
    }
}
