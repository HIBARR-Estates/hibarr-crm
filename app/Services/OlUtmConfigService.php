<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * UTM options managed on OL (GET /internal/utm-configs). The marketing lead
 * flow only lets people pick values from this list, one page at a time, so
 * it keeps working as the list on OL grows.
 *
 * Pages are cached briefly so scrolling back and forth, and the save-time
 * check, don't hit OL for every request.
 */
class OlUtmConfigService
{
    /** utm field => OL config type */
    public const TYPES = [
        'utm_source' => 'source',
        'utm_medium' => 'medium',
        'utm_campaign' => 'campaign',
        'utm_content' => 'content',
        'utm_term' => 'term',
        'utm_audience' => 'audience',
    ];

    public const PAGE_SIZE = 50;

    /** Upper bound on pages walked when checking a saved value (100 per page). */
    private const MAX_LOOKUP_PAGES = 50;

    private const CACHE_SECONDS = 300;

    /**
     * One page of configs for a type.
     *
     * @return array{items: array<int, array{value: string, label: string, leadSourceId: int|null}>, page: int, nextPage: int|null, totalCount: int}
     *
     * @throws RequestException|\RuntimeException when OL can't be reached or isn't configured
     */
    public function page(string $type, int $page = 1, int $limit = self::PAGE_SIZE, ?string $search = null): array
    {
        $page = max(1, $page);
        $limit = max(1, min(100, $limit));
        $search = $search !== null ? trim($search) : null;
        $query = array_filter([
            'type' => $type,
            'page' => $page,
            'limit' => $limit,
            'search' => $search !== '' ? $search : null,
        ], fn ($value) => $value !== null);

        $key = 'ol-utm-configs:'.md5(json_encode($query));

        return Cache::remember($key, self::CACHE_SECONDS, function () use ($query, $page) {
            $data = $this->request()->get('/internal/utm-configs', $query)->throw()->json('data') ?? [];

            $items = collect($data['result'] ?? [])
                ->filter(fn ($row) => is_array($row) && is_string($row['value'] ?? null) && $row['value'] !== '')
                ->map(fn (array $row) => [
                    'value' => $row['value'],
                    'label' => is_string($row['label'] ?? null) && $row['label'] !== '' ? $row['label'] : $row['value'],
                    'leadSourceId' => isset($row['leadSourceId']) ? (int) $row['leadSourceId'] : null,
                ])
                ->values()
                ->all();

            $nextPage = $data['nextPage'] ?? null;

            return [
                'items' => $items,
                'page' => (int) ($data['currentPage'] ?? $page),
                'nextPage' => is_numeric($nextPage) ? (int) $nextPage : null,
                'totalCount' => (int) ($data['totalCount'] ?? count($items)),
            ];
        });
    }

    /**
     * Whether OL lists this value for the type. Walks pages until it finds
     * it; the pages land in the same short cache the picker uses.
     *
     * @throws RequestException|\RuntimeException when OL can't be reached
     */
    public function has(string $type, string $value): bool
    {
        $page = 1;
        for ($walked = 0; $walked < self::MAX_LOOKUP_PAGES; $walked++) {
            $result = $this->page($type, $page, 100);
            foreach ($result['items'] as $item) {
                if ($item['value'] === $value) {
                    return true;
                }
            }
            if ($result['nextPage'] === null || $result['nextPage'] <= $page) {
                return false;
            }
            $page = $result['nextPage'];
        }

        return false;
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
