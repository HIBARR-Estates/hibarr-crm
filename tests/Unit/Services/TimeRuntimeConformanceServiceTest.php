<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Services\TimeRuntimeConformanceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Mockery;
use Tests\TestCase;

class TimeRuntimeConformanceServiceTest extends TestCase
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

    private function configureUtcRuntime(): void
    {
        config([
            'app.timezone' => 'UTC',
            'app.cron_timezone' => 'UTC',
        ]);
    }

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
        // This test exercises env fallback itself, so clear the pinned value from setUp().
        putenv('PHP_TZDATA_VERSION');

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

    public function test_database_probe_treats_sqlite_as_utc(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('sqlite');
        $connection->shouldNotReceive('selectOne');

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertTrue($report['compliant']);
        $this->assertSame('UTC', $report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_database_probe_accepts_mysql_system_timezone_with_zero_offset(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('mysql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->with('SELECT @@session.time_zone AS tz, TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS offset_diff')
            ->andReturn((object) ['tz' => 'SYSTEM', 'offset_diff' => '00:00:00']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertTrue($report['compliant']);
        $this->assertSame('SYSTEM', $report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_database_probe_accepts_mysql_explicit_utc_offset(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('mysql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->andReturn((object) ['tz' => '+00:00', 'offset_diff' => '00:00:00']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertTrue($report['compliant']);
        $this->assertSame('+00:00', $report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_database_probe_rejects_mysql_system_timezone_with_non_zero_offset(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('mysql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->andReturn((object) ['tz' => 'SYSTEM', 'offset_diff' => '+02:00:00']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertFalse($report['compliant']);
        $this->assertSame('SYSTEM', $report['dbSessionTimezone']);
        $this->assertStringContainsString(
            "Database session timezone is 'SYSTEM', expected UTC (+00:00).",
            implode(' ', $report['issues'])
        );
    }

    public function test_database_probe_accepts_postgres_timezone_uppercase_column(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->with('SHOW TIME ZONE')
            ->andReturn((object) ['TimeZone' => 'UTC']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertTrue($report['compliant']);
        $this->assertSame('UTC', $report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_database_probe_accepts_postgres_timezone_lowercase_column(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->with('SHOW TIME ZONE')
            ->andReturn((object) ['timezone' => 'UTC']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertTrue($report['compliant']);
        $this->assertSame('UTC', $report['dbSessionTimezone']);
        $this->assertSame([], $report['issues']);
    }

    public function test_database_probe_rejects_postgres_non_utc_timezone(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('pgsql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->andReturn((object) ['TimeZone' => 'Europe/Berlin']);

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertFalse($report['compliant']);
        $this->assertSame('Europe/Berlin', $report['dbSessionTimezone']);
        $this->assertStringContainsString(
            "Database session timezone is 'Europe/Berlin', expected UTC (+00:00).",
            implode(' ', $report['issues'])
        );
    }

    public function test_database_probe_reports_unsupported_driver(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('sqlsrv');
        $connection->shouldNotReceive('selectOne');

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertFalse($report['compliant']);
        $this->assertSame('sqlsrv:unknown', $report['dbSessionTimezone']);
        $this->assertStringContainsString(
            "Unsupported database driver 'sqlsrv' for session timezone probe.",
            implode(' ', $report['issues'])
        );
    }

    public function test_database_probe_reports_connection_exception(): void
    {
        $this->configureUtcRuntime();

        $connection = Mockery::mock();
        $connection->shouldReceive('getDriverName')->once()->andReturn('mysql');
        $connection->shouldReceive('selectOne')
            ->once()
            ->andThrow(new \RuntimeException('connection lost'));

        DB::shouldReceive('connection')->once()->andReturn($connection);

        $report = (new TimeRuntimeConformanceService())->verifyRuntimeUtc();

        $this->assertFalse($report['compliant']);
        $this->assertNull($report['dbSessionTimezone']);
        $this->assertStringContainsString(
            'Database session timezone probe failed: connection lost',
            implode(' ', $report['issues'])
        );
    }
}
