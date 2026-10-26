<?php

namespace App\Services\Suppression;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client for OL's global suppression check (SUP-D11 / SUP-D13).
 *
 * The CRM never keeps a copy of the list. Every SMTP-fallback email and every
 * outbound call asks OL first. A transport failure is reported as
 * `unavailable` so the caller can apply the shared fallback policy — hold
 * non-transactional, deliver transactional — instead of throwing into a send
 * path.
 *
 * Logs intentionally carry masked targets only: no full address or number
 * may leave the process in a log line.
 */
class SuppressionClient
{
    public const SCOPE_TRANSACTIONAL = 'transactional';

    public const SCOPE_NON_TRANSACTIONAL = 'non_transactional';

    public const SCOPE_ALL = 'all';

    /**
     * @param  array{email?: string, phone?: string}  $target
     */
    public function checkTarget(
        array $target,
        string $scope = self::SCOPE_NON_TRANSACTIONAL
    ): SuppressionCheckResult {
        $payload = ['scope' => $scope];

        if (! empty($target['email'])) {
            $payload['email'] = trim((string) $target['email']);
        }

        if (! empty($target['phone'])) {
            $payload['phone'] = trim((string) $target['phone']);
        }

        if (! isset($payload['email']) && ! isset($payload['phone'])) {
            return SuppressionCheckResult::allowed($scope);
        }

        return $this->checkBatch([$payload])[0]
            ?? SuppressionCheckResult::allowed($scope);
    }

    public function checkEmail(
        string $email,
        string $scope = self::SCOPE_NON_TRANSACTIONAL
    ): SuppressionCheckResult {
        return $this->checkTarget(['email' => $email], $scope);
    }

    /**
     * Agent-initiated calls are transactional by default; an `all`-scope
     * entry still blocks them.
     */
    public function checkPhone(
        string $phone,
        string $scope = self::SCOPE_TRANSACTIONAL
    ): SuppressionCheckResult {
        return $this->checkTarget(['phone' => $phone], $scope);
    }

    /**
     * @param  array<int, array{email?: string, phone?: string, scope: string}>  $items
     * @return array<int, SuppressionCheckResult>
     */
    public function checkBatch(array $items): array
    {
        if ($items === []) {
            return [];
        }

        $baseUrl = $this->baseUrl();
        $apiKey = $this->apiKey();

        if ($baseUrl === '' || $apiKey === '') {
            Log::critical('Suppression check unavailable: OL suppression endpoint is not configured.', [
                'base_url_set' => $baseUrl !== '',
                'api_key_set' => $apiKey !== '',
                'items' => count($items),
            ]);

            return array_map(
                fn (array $item): SuppressionCheckResult => SuppressionCheckResult::unavailable(
                    (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL)
                ),
                $items
            );
        }

        $url = rtrim($baseUrl, '/').'/'.ltrim($this->checkPath(), '/');

        try {
            $response = Http::timeout($this->timeout())
                ->withHeaders([
                    'Accept' => 'application/json',
                    // Same credential/header the other OL integrations use.
                    'X-Api-Key' => $apiKey,
                ])
                ->post($url, ['items' => array_values($items)]);
        } catch (\Throwable $exception) {
            Log::critical('Suppression check unavailable: OL request failed.', [
                'error' => $exception->getMessage(),
                'targets' => $this->maskedTargets($items),
            ]);

            return array_map(
                fn (array $item): SuppressionCheckResult => SuppressionCheckResult::unavailable(
                    (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL)
                ),
                $items
            );
        }

        if (! $response->successful()) {
            // The upstream body can echo addresses back, so it is never logged.
            Log::critical('Suppression check unavailable: OL returned non-2xx.', [
                'status' => $response->status(),
                'targets' => $this->maskedTargets($items),
            ]);

            return array_map(
                fn (array $item): SuppressionCheckResult => SuppressionCheckResult::unavailable(
                    (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL)
                ),
                $items
            );
        }

        $data = $response->json('data');
        if (! is_array($data)) {
            Log::critical('Suppression check unavailable: unexpected OL response shape.', [
                'targets' => $this->maskedTargets($items),
            ]);

            return array_map(
                fn (array $item): SuppressionCheckResult => SuppressionCheckResult::unavailable(
                    (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL)
                ),
                $items
            );
        }

        if (($data['unavailable'] ?? false) === true) {
            return array_map(
                fn (array $item): SuppressionCheckResult => SuppressionCheckResult::unavailable(
                    (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL)
                ),
                $items
            );
        }

        $enforced = ($data['enforced'] ?? true) !== false;
        $rows = is_array($data['items'] ?? null) ? $data['items'] : [];

        $results = [];

        foreach (array_values($items) as $index => $item) {
            $scope = (string) ($item['scope'] ?? self::SCOPE_NON_TRANSACTIONAL);
            $row = $rows[$index] ?? null;

            if (! is_array($row)) {
                // A response that omits a requested item is not a clean
                // "not suppressed" answer; apply the same outage policy as a
                // failed request instead of allowing the send.
                $results[] = SuppressionCheckResult::unavailable($scope);

                continue;
            }

            $wouldBlock = (bool) ($row['wouldBlock'] ?? $row['blocked'] ?? false);
            $reason = $row['suppression']['reason'] ?? null;

            $results[] = new SuppressionCheckResult(
                blocked: $wouldBlock && $enforced,
                wouldBlock: $wouldBlock,
                unavailable: false,
                scope: $scope,
                reason: is_string($reason) ? $reason : null,
            );
        }

        return $results;
    }

    private function baseUrl(): string
    {
        return trim((string) config('services.ol.base_url', ''));
    }

    private function apiKey(): string
    {
        return trim((string) config('services.ol.api_key', ''));
    }

    private function checkPath(): string
    {
        return '/suppression/check';
    }

    private function timeout(): int
    {
        return max(1, (int) config('services.ol.timeout', 5));
    }

    /**
     * @param  array<int, array{email?: string, phone?: string, scope?: string}>  $items
     * @return array<int, string>
     */
    private function maskedTargets(array $items): array
    {
        return array_map(function (array $item): string {
            if (! empty($item['email'])) {
                return self::maskEmail((string) $item['email']);
            }

            if (! empty($item['phone'])) {
                return self::maskPhone((string) $item['phone']);
            }

            return '(masked)';
        }, $items);
    }

    public static function maskEmail(string $email): string
    {
        $email = trim($email);
        $at = strpos($email, '@');

        if ($at === false || $at === 0) {
            return '(masked)';
        }

        $local = substr($email, 0, $at);
        $domain = substr($email, $at + 1);
        $visible = min(1, strlen($local));

        return substr($local, 0, $visible).'***@'.substr($domain, 0, 2).'***';
    }

    public static function maskPhone(string $phone): string
    {
        $normalized = trim($phone);

        if (strlen($normalized) < 6) {
            return '(masked)';
        }

        return substr($normalized, 0, 4).'***'.substr($normalized, -2);
    }
}
