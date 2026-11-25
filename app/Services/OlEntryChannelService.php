<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The lead entry channel catalog managed on OL (GET /internal/entry-channels), read with the same API
 * key as the UTM configs. OL owns the tree; the CRM only reads it, to label channels in the
 * automation builder. Routing never calls it: every entry arrives carrying its own channel.
 *
 * Archived channels are included, so an automation scoped to one still shows its name.
 */
class OlEntryChannelService
{
    private const CACHE_SECONDS = 300;

    /**
     * @return array<int, array{uuid: string, key: string, name: string, type: string, path: string, depth: int, parentUuid: string|null, status: string, tags: array<int, string>}>
     */
    public function channels(): array
    {
        try {
            return Cache::remember('ol-entry-channels', self::CACHE_SECONDS, function () {
                $rows = $this->request()
                    ->get('/internal/entry-channels', ['includeArchived' => 'true'])
                    ->throw()
                    ->json('data') ?? [];

                return collect($rows)
                    ->filter(fn ($row) => is_array($row) && is_string($row['uuid'] ?? null))
                    ->map(fn (array $row) => [
                        'uuid' => $row['uuid'],
                        'key' => (string) ($row['key'] ?? ''),
                        'name' => (string) ($row['name'] ?? $row['key'] ?? ''),
                        'type' => (string) ($row['type'] ?? ''),
                        'path' => (string) ($row['path'] ?? ''),
                        'depth' => (int) ($row['depth'] ?? 0),
                        'parentUuid' => $row['parentUuid'] ?? null,
                        'status' => (string) ($row['status'] ?? 'active'),
                        'tags' => array_values((array) ($row['tags'] ?? [])),
                    ])
                    ->values()
                    ->all();
            });
        } catch (\Throwable $e) {
            // The builder still works without names; it shows what it has.
            Log::warning('OlEntryChannelService: could not read the channel catalog', ['message' => $e->getMessage()]);

            return [];
        }
    }

    private function request()
    {
        $baseUrl = trim((string) config('services.ol.base_url', ''));
        if ($baseUrl === '') {
            throw new \RuntimeException('OL base URL is not configured.');
        }

        return Http::baseUrl($baseUrl)
            ->acceptJson()
            ->timeout(max(1, (int) config('services.ol.timeout', 15)))
            ->withHeaders(['x-api-key' => (string) config('services.ol.api_key', '')]);
    }
}
