<?php

namespace App\Services;

use App\Jobs\TranslateDynamicContentJob;
use App\Models\DynamicTranslation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DynamicTranslationService
{
    private const CACHE_TTL_SECONDS = 3600;
    private const TARGET_LOCALES = ['de', 'ru', 'tr'];

    private string $baseUrl;
    private int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(
            (string) config('services.dynamic_translation.base_url', config('services.ai.base_url', 'https://staging-api.hibarr.org/v1')),
            '/'
        );
        $this->timeout = (int) config('services.dynamic_translation.timeout', config('services.ai.timeout', 30));
    }

    public function normalize(string $text): string
    {
        return Str::of($text)
            ->trim()
            ->lower()
            ->replaceMatches('/\\s+/', ' ')
            ->toString();
    }

    public function hash(string $text): string
    {
        return hash('sha256', $this->normalize($text));
    }

    public function findByHash(string $hash): ?DynamicTranslation
    {
        return Cache::remember(
            $this->cacheKey($hash),
            self::CACHE_TTL_SECONDS,
            static fn (): ?DynamicTranslation => DynamicTranslation::query()
                ->where('hash_key', $hash)
                ->first()
        );
    }

    public function ensureExists(string $text): DynamicTranslation
    {
        $normalized = $this->normalize($text);

        if ($normalized === '') {
            throw new \InvalidArgumentException('Dynamic translation text cannot be empty after normalization.');
        }

        $hash = hash('sha256', $normalized);
        $existing = $this->findByHash($hash);

        if ($existing) {
            if (!$existing->isComplete()) {
                TranslateDynamicContentJob::dispatch($existing);
            }

            return $existing;
        }

        try {
            $translation = DynamicTranslation::query()->create([
                'hash_key' => $hash,
                'source_text' => $text,
                'en' => $text,
                'status' => DynamicTranslation::STATUS_PENDING,
            ]);
        } catch (QueryException $exception) {
            // Handle unique race on hash_key under concurrent writes.
            $translation = DynamicTranslation::query()->where('hash_key', $hash)->first();

            if (!$translation) {
                throw $exception;
            }
        }

        Cache::forget($this->cacheKey($hash));
        TranslateDynamicContentJob::dispatch($translation);

        return $translation;
    }

    /**
     * @param array<int, string> $texts
     */
    public function bulkEnsure(array $texts): void
    {
        foreach ($texts as $text) {
            if (!is_string($text) || trim($text) === '') {
                continue;
            }

            try {
                $this->ensureExists($text);
            } catch (\Throwable $exception) {
                Log::warning('DynamicTranslationService: Failed to ensure translation', [
                    'text' => Str::limit($text, 120),
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    public function translateAll(DynamicTranslation $translation): DynamicTranslation
    {
        $sourceText = trim((string) $translation->source_text);

        if ($sourceText === '') {
            $translation->status = DynamicTranslation::STATUS_PARTIAL;
            $translation->save();
            return $translation;
        }

        $responses = Http::pool(function (Pool $pool) use ($sourceText) {
            foreach (self::TARGET_LOCALES as $locale) {
                $pool->as($locale)
                    ->timeout($this->timeout)
                    ->post("{$this->baseUrl}/translation", [
                        'text' => $sourceText,
                        'targetLang' => $locale,
                    ]);
            }
        });

        $updates = [
            'en' => $translation->en ?: $sourceText,
        ];

        $successfulCount = 0;

        foreach (self::TARGET_LOCALES as $locale) {
            $response = $responses[$locale] ?? null;

            if (!$response || !$response->successful()) {
                Log::warning('DynamicTranslationService: Translation API call failed', [
                    'hash_key' => $translation->hash_key,
                    'locale' => $locale,
                    'status' => $response?->status(),
                    'response' => $response?->body(),
                ]);
                continue;
            }

            $translatedText = $response->json('data.text');

            if (!is_string($translatedText) || trim($translatedText) === '') {
                Log::warning('DynamicTranslationService: Translation API returned empty text', [
                    'hash_key' => $translation->hash_key,
                    'locale' => $locale,
                    'response' => $response->json(),
                ]);
                continue;
            }

            $updates[$locale] = $translatedText;
            $successfulCount++;
        }

        if ($successfulCount === count(self::TARGET_LOCALES)) {
            $updates['status'] = DynamicTranslation::STATUS_COMPLETE;
        } elseif ($successfulCount > 0) {
            $updates['status'] = DynamicTranslation::STATUS_PARTIAL;
        } else {
            $updates['status'] = DynamicTranslation::STATUS_PENDING;
        }

        $translation->fill($updates);
        $translation->save();

        Cache::forget($this->cacheKey($translation->hash_key));

        return $translation;
    }

    private function cacheKey(string $hash): string
    {
        return "dyn_trans_{$hash}";
    }
}
