<?php

namespace App\Services;

use App\Jobs\TranslateDynamicContentJob;
use App\Models\DynamicTranslation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DynamicTranslationService
{
    private const CACHE_TTL_SECONDS = 3600;

    private const TARGET_LOCALES = ['de', 'ru', 'tr'];

    /**
     * Minimum gap between job dispatches for the same hash. Every poll from
     * every open tab hits `ensureExists()` for a still-incomplete row, so
     * without this an API outage turns each poll into a fresh job — all
     * re-translating the locales that already succeeded too, since
     * `translateAll()` redoes every target locale unconditionally.
     */
    private const DISPATCH_COOLDOWN_SECONDS = 30;

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
     * Trim + collapse whitespace only. Case-preserving so product strings
     * with different casing remain distinct dictionary keys.
     *
     * Collapse (with the `u` modifier, so `\s` catches NBSP and other Unicode
     * whitespace) before trim — the frontend's `.trim()`/`\s` already treats
     * those as whitespace, so trimming first here would leave a boundary NBSP
     * in place and hash differently than the JS side, which permanently
     * rejects that text as a "hash mismatch" and never queues its translation.
     */
    public function normalize(string $text): string
    {
        return Str::of($text)
            ->replaceMatches('/\s+/u', ' ')
            ->trim()
            ->toString();
    }

    public function hash(string $text): string
    {
        return hash('sha256', $this->normalize($text));
    }

    /**
     * Strips HTML tags and protects `{{merge.field}}` tokens before text is
     * sent to the translation API. Qualification scripts are rich-text HTML
     * with unresolved OL/CRM mustache tokens (see qualificationUtils.ts's
     * `OL_TOKEN_REPLACEMENTS`) — sending that markup straight through gets it
     * mistranslated or mangled by the translator, which most often comes
     * back empty and leaves the record stuck incomplete forever.
     *
     * Hashing/`source_text`/the stored `en` value are untouched — this only
     * shapes what goes out over the wire for DE/RU/TR.
     *
     * @return array{0: string, 1: array<string, string>} [plain text, token => original placeholder]
     */
    private function extractTranslatableText(string $html): array
    {
        $placeholders = [];
        $index = 0;

        $protected = preg_replace_callback(
            '/\{\{[^{}]+\}\}/',
            function (array $match) use (&$placeholders, &$index): string {
                $token = "__PH{$index}__";
                $placeholders[$token] = $match[0];
                $index++;

                return $token;
            },
            $html
        ) ?? $html;

        $stripped = preg_replace('/<[^>]+>/', ' ', $protected) ?? $protected;
        $decoded = html_entity_decode($stripped, ENT_QUOTES | ENT_HTML5);

        return [$this->normalize($decoded), $placeholders];
    }

    /**
     * @param  array<string, string>  $placeholders
     */
    private function restorePlaceholders(string $text, array $placeholders): string
    {
        return $placeholders === [] ? $text : strtr($text, $placeholders);
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

        $hash = $this->hash($text);
        $existing = $this->findByHash($hash);

        if ($existing) {
            if (! $existing->isComplete()) {
                $this->dispatchTranslationJob($existing);
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

            if (! $translation) {
                throw $exception;
            }
        }

        Cache::forget($this->cacheKey($hash));
        $this->dispatchTranslationJob($translation);

        return $translation;
    }

    /**
     * Dispatches at most one job per hash per cooldown window. `Cache::add`
     * is atomic (set-if-absent), so concurrent requests for the same hash
     * only let one through.
     */
    private function dispatchTranslationJob(DynamicTranslation $translation): void
    {
        if (Cache::add($this->dispatchLockKey($translation->hash_key), true, self::DISPATCH_COOLDOWN_SECONDS)) {
            TranslateDynamicContentJob::dispatch($translation);
        }
    }

    /**
     * @param  array<int, string>  $texts
     */
    public function bulkEnsure(array $texts): void
    {
        foreach ($texts as $text) {
            if (! is_string($text) || trim($text) === '') {
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

        [$plainText, $placeholders] = $this->extractTranslatableText($sourceText);

        if ($plainText === '') {
            // Markup/placeholders only (e.g. an empty rich-text paragraph) —
            // nothing left to translate.
            $translation->status = DynamicTranslation::STATUS_PARTIAL;
            $translation->save();

            return $translation;
        }

        $responses = Http::pool(function (Pool $pool) use ($plainText) {
            foreach (self::TARGET_LOCALES as $locale) {
                $request = $pool->as($locale)
                    ->timeout($this->timeout);

                if ($this->apiKey !== null) {
                    $request = $request->withHeaders([
                        'X-API-KEY' => $this->apiKey,
                    ]);
                }

                $request->post("{$this->baseUrl}/translation", [
                    'text' => $plainText,
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

            if (! $response instanceof Response) {
                Log::warning('DynamicTranslationService: Translation API call failed', [
                    'hash_key' => $translation->hash_key,
                    'locale' => $locale,
                    'error' => $response instanceof \Throwable ? $response->getMessage() : 'no response',
                    'response' => $response instanceof Response ? $response->body() : null,
                ]);

                continue;
            }

            if (! $response->successful()) {
                Log::warning('DynamicTranslationService: Translation API call failed', [
                    'hash_key' => $translation->hash_key,
                    'locale' => $locale,
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);

                continue;
            }

            $translatedText = $response->json('data.text');

            if (! is_string($translatedText) || trim($translatedText) === '') {
                Log::warning('DynamicTranslationService: Translation API returned empty text', [
                    'hash_key' => $translation->hash_key,
                    'locale' => $locale,
                    'response' => $response->json(),
                ]);

                continue;
            }

            $updates[$locale] = $this->restorePlaceholders($translatedText, $placeholders);
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

    private function dispatchLockKey(string $hash): string
    {
        return "dyn_trans_dispatch_{$hash}";
    }
}
