<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FeatureFlagService
{
    /** @var array<string, bool>|null */
    private ?array $resolved = null;

    /** @var array<string, bool>|null */
    private ?array $testingOverrides = null;

    private string $baseUrl;
    private int $timeout;
    private ?string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(
            (string) config('services.dynamic_translation.base_url', config('services.ai.base_url', '')),
            '/'
        );
        $this->timeout = (int) config('services.dynamic_translation.timeout', config('services.ai.timeout', 30));
        $apiKey = config('services.dynamic_translation.api_key', config('services.ai.api_key'));
        $this->apiKey = is_string($apiKey) && trim($apiKey) !== '' ? $apiKey : null;
    }

    /**
     * @return array<string, bool>
     */
    public function all(): array
    {
        if ($this->resolved !== null) {
            return $this->resolved;
        }

        if (app()->environment('testing') && $this->testingOverrides !== null) {
            return $this->resolved = array_merge(
                $this->allFalseKnownFlags(),
                $this->testingOverrides
            );
        }

        $sessionId = $this->resolveSessionId();
        $cacheKey = $this->cacheKey($sessionId);
        $cacheTtl = (int) config('features.cache_ttl', 10);

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $this->resolved = $this->normalizeFlags($cached);
        }

        $fetched = $this->fetchFromApi($sessionId);

        if ($fetched !== null) {
            Cache::put($cacheKey, $fetched, $cacheTtl);
            Cache::put($this->lastGoodCacheKey($sessionId), $fetched, now()->addDay());

            return $this->resolved = $fetched;
        }

        Log::warning('FeatureFlagService: Failed to fetch feature flags, using fallback', [
            'session_id' => $sessionId,
        ]);

        $stale = $this->staleCacheOrNull($sessionId);
        if ($stale !== null) {
            return $this->resolved = $stale;
        }

        return $this->resolved = $this->allFalseKnownFlags();
    }

    public function isEnabled(string $flag): bool
    {
        return (bool) ($this->all()[$flag] ?? false);
    }

    /**
     * @return array<string, bool>
     */
    public function forInertia(): array
    {
        $all = $this->all();
        $knownFlags = config('features.known_flags', []);
        $result = [];

        foreach ($knownFlags as $flag) {
            $result[$flag] = (bool) ($all[$flag] ?? false);
        }

        return $result;
    }

    /**
     * @param array<string, bool> $overrides
     */
    public function setTestingOverrides(array $overrides): void
    {
        if (!app()->environment('testing')) {
            return;
        }

        $this->testingOverrides = $overrides;
        $this->resolved = null;
    }

    public function clearTestingOverrides(): void
    {
        $this->testingOverrides = null;
        $this->resolved = null;
    }

    /**
     * @return array<string, bool>|null
     */
    public function getTestingOverrides(): ?array
    {
        return $this->testingOverrides;
    }

    /**
     * @return array<string, bool>|null
     */
    private function fetchFromApi(string $sessionId): ?array
    {
        $request = Http::timeout($this->timeout);

        if ($this->apiKey !== null) {
            $request = $request->withHeaders([
                'X-API-KEY' => $this->apiKey,
            ]);
        }

        try {
            $response = $request->get("{$this->baseUrl}/shared/flags", [
                'appName' => (string) config('features.app_name', 'crm'),
                'sessionId' => $sessionId,
            ]);
        } catch (\Throwable $exception) {
            Log::warning('FeatureFlagService: Feature flags API request failed', [
                'session_id' => $sessionId,
                'error' => $exception->getMessage(),
            ]);

            return $this->staleCacheOrNull($sessionId);
        }

        if (!$response->successful()) {
            Log::warning('FeatureFlagService: Feature flags API returned error', [
                'session_id' => $sessionId,
                'status' => $response->status(),
                'response' => $response->body(),
            ]);

            return $this->staleCacheOrNull($sessionId);
        }

        $flags = $response->json('data.flags');

        if (!is_array($flags)) {
            Log::warning('FeatureFlagService: Feature flags API returned invalid payload', [
                'session_id' => $sessionId,
                'response' => $response->json(),
            ]);

            return $this->staleCacheOrNull($sessionId);
        }

        return $this->normalizeFlags($flags);
    }

    /**
     * @return array<string, bool>|null
     */
    private function staleCacheOrNull(string $sessionId): ?array
    {
        $cached = Cache::get($this->cacheKey($sessionId));
        if (is_array($cached)) {
            return $this->normalizeFlags($cached);
        }

        $lastGood = Cache::get($this->lastGoodCacheKey($sessionId));

        return is_array($lastGood) ? $this->normalizeFlags($lastGood) : null;
    }

    /**
     * @param array<mixed, mixed> $raw
     * @return array<string, bool>
     */
    private function normalizeFlags(array $raw): array
    {
        $normalized = [];

        foreach ($raw as $key => $value) {
            $normalized[(string) $key] = (bool) $value;
        }

        return $normalized;
    }

    /**
     * @param array<string, bool> $flags
     * @return array<string, bool>
     */
    private function allFalseKnownFlags(): array
    {
        $knownFlags = config('features.known_flags', []);

        return array_fill_keys($knownFlags, false);
    }

    private function resolveSessionId(): string
    {
        try {
            $request = request();

            if ($request !== null && $request->hasSession()) {
                return $request->session()->getId();
            }
        } catch (\Throwable) {
            // Session is unavailable outside HTTP requests.
        }

        return 'system';
    }

    private function cacheKey(string $sessionId): string
    {
        $appName = (string) config('features.app_name', 'crm');

        return "feature_flags:{$appName}:{$sessionId}";
    }

    private function lastGoodCacheKey(string $sessionId): string
    {
        return $this->cacheKey($sessionId) . ':last_good';
    }
}
