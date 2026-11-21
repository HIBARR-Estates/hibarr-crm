<?php

declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Runtime UTC alignment (time ADR INV-11) and PHP tzdata version publisher (HIB-2000).
 *
 * Ensures PHP, Laravel config/cron, and database session timezones run in UTC,
 * and publishes PHP's resolved IANA tzdata release (e.g. "2026f") to an unprefixed
 * Redis key (`tzdata:version:php`) so hibarr-backend can alert on Postgres/Node/PHP drift.
 */
class TimeRuntimeConformanceService
{
    public const TZDATA_PHP_VERSION_REDIS_KEY = 'tzdata:version:php';

    /**
     * UTC timezone identifiers accepted across PHP, OS TZ, and DB sessions.
     *
     * @var list<string>
     */
    private const UTC_IDENTIFIERS = [
        'UTC',
        'ETC/UTC',
        'ETC/GMT',
        'GMT',
        'GMT+0',
        'GMT-0',
        'GMT0',
        'Z',
        '+00:00',
        '-00:00',
        '+0000',
        '-0000',
        '+00',
        '00:00:00',
    ];

    /**
     * Zero offset strings returned by MySQL TIMEDIFF(NOW(), UTC_TIMESTAMP()).
     *
     * @var list<string>
     */
    private const ZERO_TIME_DIFFS = [
        '00:00:00',
        '-00:00:00',
        '00:00:00.000000',
        '-00:00:00.000000',
    ];

    /**
     * Normalize raw tzdata strings (e.g. "2025b", "2025.2", "tzdata 2025c") to canonical IANA format.
     */
    public function parseTzdataVersion(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^(\d{4}[a-z])$/i', $trimmed, $exactMatch) === 1) {
            return strtolower($exactMatch[1]);
        }

        // PHP timezone_version_get() formats timezonedb releases numerically as YYYY.N (e.g. 2025.2 -> 2025b).
        if (preg_match('/(\d{4})\.(\d+)/', $trimmed, $numericMatch) === 1) {
            $releaseNumber = (int) $numericMatch[2];
            if ($releaseNumber >= 1 && $releaseNumber <= 26) {
                return $numericMatch[1] . chr(96 + $releaseNumber);
            }
        }

        if (preg_match('/(\d{4}[a-z])/i', $trimmed, $embeddedMatch) === 1) {
            return strtolower($embeddedMatch[1]);
        }

        return null;
    }

    /**
     * Resolve the effective PHP tzdata version and metadata.
     *
     * @return array{
     *     version: ?string,
     *     rawPhpTzdbVersion: string,
     *     icuTzdataVersion: ?string,
     *     source: 'env'|'php_timezonedb'|'php_intl_icu'|'unavailable'
     * }
     */
    public function resolvePhpTzdataVersion(?string $overrideRaw = null): array
    {
        $rawPhpTzdb = timezone_version_get();
        $rawIcu = function_exists('intltz_get_tz_data_version') ? intltz_get_tz_data_version() : false;
        $icuTzdataVersion = is_string($rawIcu) && trim($rawIcu) !== '' ? $rawIcu : null;

        $envOverride = ($overrideRaw !== null && trim($overrideRaw) !== '')
            ? $overrideRaw
            : ($this->readEnvValue('PHP_TZDATA_VERSION') ?? $this->readEnvValue('CRM_TZDATA_VERSION'));

        if ($envOverride !== null) {
            $parsedEnv = $this->parseTzdataVersion($envOverride);
            if ($parsedEnv !== null) {
                return [
                    'version' => $parsedEnv,
                    'rawPhpTzdbVersion' => $rawPhpTzdb,
                    'icuTzdataVersion' => $icuTzdataVersion,
                    'source' => 'env',
                ];
            }
        }

        $parsedTzdb = $this->parseTzdataVersion($rawPhpTzdb);
        if ($parsedTzdb !== null) {
            return [
                'version' => $parsedTzdb,
                'rawPhpTzdbVersion' => $rawPhpTzdb,
                'icuTzdataVersion' => $icuTzdataVersion,
                'source' => 'php_timezonedb',
            ];
        }

        $parsedIcu = $this->parseTzdataVersion($icuTzdataVersion);
        if ($parsedIcu !== null) {
            return [
                'version' => $parsedIcu,
                'rawPhpTzdbVersion' => $rawPhpTzdb,
                'icuTzdataVersion' => $icuTzdataVersion,
                'source' => 'php_intl_icu',
            ];
        }

        return [
            'version' => null,
            'rawPhpTzdbVersion' => $rawPhpTzdb,
            'icuTzdataVersion' => $icuTzdataVersion,
            'source' => 'unavailable',
        ];
    }

    /**
     * Check whether a timezone identifier represents UTC (+00:00).
     */
    public function isUtcTimezoneIdentifier(?string $tz): bool
    {
        if ($tz === null) {
            return false;
        }

        $normalized = strtoupper(trim($tz));

        return in_array($normalized, self::UTC_IDENTIFIERS, true);
    }

    /**
     * Verify process, PHP, Laravel config, scheduler, logger, and DB session timezones are UTC.
     *
     * @return array{
     *     compliant: bool,
     *     processTz: ?string,
     *     phpDefaultTimezone: string,
     *     appTimezone: string,
     *     cronTimezone: string,
     *     dbSessionTimezone: ?string,
     *     utcOffsetSeconds: int,
     *     loggerTimestampUtc: bool,
     *     issues: list<string>
     * }
     */
    public function verifyRuntimeUtc(): array
    {
        $processTz = $this->readEnvValue('TZ');
        $phpDefaultTimezone = date_default_timezone_get();
        $appTimezone = (string) config('app.timezone', 'UTC');
        $cronTimezone = (string) config('app.cron_timezone', 'UTC');
        $utcOffsetSeconds = (new DateTimeImmutable('now'))->getOffset();
        $loggerTimestampUtc = $utcOffsetSeconds === 0 && $this->isUtcTimezoneIdentifier($phpDefaultTimezone);

        $issues = [];

        if ($processTz !== null && ! $this->isUtcTimezoneIdentifier($processTz)) {
            $issues[] = "Process TZ env is '{$processTz}', expected UTC.";
        }

        if (! $this->isUtcTimezoneIdentifier($phpDefaultTimezone)) {
            $issues[] = "PHP default timezone is '{$phpDefaultTimezone}', expected UTC.";
        }

        if (! $this->isUtcTimezoneIdentifier($appTimezone)) {
            $issues[] = "Laravel app.timezone is '{$appTimezone}', expected UTC.";
        }

        if (! $this->isUtcTimezoneIdentifier($cronTimezone)) {
            $issues[] = "Laravel app.cron_timezone is '{$cronTimezone}', expected UTC.";
        }

        if ($utcOffsetSeconds !== 0) {
            $issues[] = "Current PHP DateTimeImmutable UTC offset is {$utcOffsetSeconds} seconds, expected 0.";
        }

        $dbProbe = $this->resolveDatabaseSessionTimezone();
        if ($dbProbe['error'] !== null) {
            $issues[] = 'Database session timezone probe failed: ' . $dbProbe['error'];
        } elseif (! $dbProbe['compliant']) {
            $reportedTz = $dbProbe['timezone'] ?? 'unknown';
            $issues[] = "Database session timezone is '{$reportedTz}', expected UTC (+00:00).";
        }

        return [
            'compliant' => $issues === [],
            'processTz' => $processTz,
            'phpDefaultTimezone' => $phpDefaultTimezone,
            'appTimezone' => $appTimezone,
            'cronTimezone' => $cronTimezone,
            'dbSessionTimezone' => $dbProbe['timezone'],
            'utcOffsetSeconds' => $utcOffsetSeconds,
            'loggerTimestampUtc' => $loggerTimestampUtc,
            'issues' => $issues,
        ];
    }

    /**
     * Publish PHP's normalized tzdata version to the unprefixed Redis key read by hibarr-backend.
     */
    public function publishPhpTzdataVersion(?string $version = null): bool
    {
        $versionToPublish = $version ?? $this->resolvePhpTzdataVersion()['version'];
        if ($versionToPublish === null) {
            Log::warning('Cannot publish PHP tzdata version to Redis: version could not be resolved.');

            return false;
        }

        $connectionName = (string) config('app.tzdata.redis_connection', 'tzdata');
        $key = (string) config('app.tzdata.redis_key', self::TZDATA_PHP_VERSION_REDIS_KEY);
        $ttlSeconds = max(60, (int) config('app.tzdata.redis_ttl_seconds', 86400));

        try {
            Redis::connection($connectionName)->set($key, $versionToPublish, 'EX', $ttlSeconds);

            return true;
        } catch (Throwable $e) {
            Log::warning('Failed to publish PHP tzdata version to Redis.', [
                'connection' => $connectionName,
                'key' => $key,
                'version' => $versionToPublish,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Run UTC runtime conformance check, resolve tzdata version, optionally publish to Redis, and log result.
     *
     * @return array{
     *     checkedAt: string,
     *     healthy: bool,
     *     utc: array{
     *         compliant: bool,
     *         processTz: ?string,
     *         phpDefaultTimezone: string,
     *         appTimezone: string,
     *         cronTimezone: string,
     *         dbSessionTimezone: ?string,
     *         utcOffsetSeconds: int,
     *         loggerTimestampUtc: bool,
     *         issues: list<string>
     *     },
     *     tzdata: array{
     *         version: ?string,
     *         rawPhpTzdbVersion: string,
     *         icuTzdataVersion: ?string,
     *         source: 'env'|'php_timezonedb'|'php_intl_icu'|'unavailable'
     *     },
     *     publishedToRedis: bool
     * }
     */
    public function checkAndPublish(bool $publishToRedis = true): array
    {
        $utc = $this->verifyRuntimeUtc();
        $tzdata = $this->resolvePhpTzdataVersion();
        $published = $publishToRedis ? $this->publishPhpTzdataVersion($tzdata['version']) : false;
        $healthy = $utc['compliant'] && $tzdata['version'] !== null;

        $logContext = [
            'healthy' => $healthy,
            'utcCompliant' => $utc['compliant'],
            'phpDefaultTimezone' => $utc['phpDefaultTimezone'],
            'appTimezone' => $utc['appTimezone'],
            'cronTimezone' => $utc['cronTimezone'],
            'dbSessionTimezone' => $utc['dbSessionTimezone'],
            'phpTzdataVersion' => $tzdata['version'],
            'rawPhpTzdbVersion' => $tzdata['rawPhpTzdbVersion'],
            'tzdataSource' => $tzdata['source'],
            'publishedToRedis' => $published,
            'issues' => $utc['issues'],
        ];

        if ($healthy) {
            Log::info('CRM runtime UTC alignment and PHP tzdata check passed.', $logContext);
        } else {
            Log::warning('CRM runtime UTC alignment or PHP tzdata check reported issues.', $logContext);
        }

        return [
            'checkedAt' => gmdate('Y-m-d\TH:i:s\Z'),
            'healthy' => $healthy,
            'utc' => $utc,
            'tzdata' => $tzdata,
            'publishedToRedis' => $published,
        ];
    }

    /**
     * Probe the active database connection's session timezone.
     *
     * @return array{timezone: ?string, compliant: bool, error: ?string}
     */
    private function resolveDatabaseSessionTimezone(): array
    {
        try {
            $connection = DB::connection();
            $driver = $connection->getDriverName();

            if ($driver === 'sqlite') {
                return [
                    'timezone' => 'UTC',
                    'compliant' => true,
                    'error' => null,
                ];
            }

            if (in_array($driver, ['mysql', 'mariadb'], true)) {
                $row = $connection->selectOne(
                    'SELECT @@session.time_zone AS tz, TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS offset_diff'
                );

                $tz = is_object($row) && isset($row->tz) ? (string) $row->tz : null;
                $offsetDiff = is_object($row) && isset($row->offset_diff) ? (string) $row->offset_diff : null;
                $isSystemUtc = $tz !== null
                    && strtoupper(trim($tz)) === 'SYSTEM'
                    && $offsetDiff !== null
                    && in_array(trim($offsetDiff), self::ZERO_TIME_DIFFS, true);

                return [
                    'timezone' => $tz,
                    'compliant' => $this->isUtcTimezoneIdentifier($tz) || $isSystemUtc,
                    'error' => null,
                ];
            }

            if ($driver === 'pgsql') {
                $row = $connection->selectOne('SHOW TIME ZONE');
                $tz = null;
                if (is_object($row)) {
                    if (isset($row->TimeZone)) {
                        $tz = (string) $row->TimeZone;
                    } elseif (isset($row->timezone)) {
                        $tz = (string) $row->timezone;
                    }
                }

                return [
                    'timezone' => $tz,
                    'compliant' => $this->isUtcTimezoneIdentifier($tz),
                    'error' => null,
                ];
            }

            return [
                'timezone' => $driver . ':unknown',
                'compliant' => false,
                'error' => "Unsupported database driver '{$driver}' for session timezone probe.",
            ];
        } catch (Throwable $e) {
            return [
                'timezone' => null,
                'compliant' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function readEnvValue(string $key): ?string
    {
        $value = getenv($key);
        if ($value !== false && trim($value) !== '') {
            return trim($value);
        }

        foreach ([$_ENV[$key] ?? null, $_SERVER[$key] ?? null] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }
}
