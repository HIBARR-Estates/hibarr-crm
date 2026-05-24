<?php

namespace App\Http\Controllers;

use App\Models\DynamicTranslation;
use App\Services\DynamicTranslationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DynamicTranslationController extends Controller
{
    public function batch(Request $request, DynamicTranslationService $translationService): JsonResponse
    {
        $validated = $request->validate([
            'locale' => 'required|string|in:en,de,ru,tr',
            'items' => 'required|array|min:1|max:500',
            'items.*.hash' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'items.*.text' => 'nullable|string|max:10000',
        ]);

        $locale = $validated['locale'];
        $items = $validated['items'];

        $hashes = array_values(array_unique(array_map(
            static fn (array $item): string => strtolower($item['hash']),
            $items
        )));

        /** @var \Illuminate\Support\Collection<string, DynamicTranslation> $recordsByHash */
        $recordsByHash = DynamicTranslation::query()
            ->whereIn('hash_key', $hashes)
            ->get()
            ->keyBy('hash_key');

        $translations = [];
        $queuedCount = 0;

        foreach ($items as $item) {
            $hash = strtolower($item['hash']);
            $text = isset($item['text']) && is_string($item['text']) ? trim($item['text']) : '';
            $record = $recordsByHash->get($hash);

            if ($record) {
                $value = $record->{$locale};
                $translations[$hash] = is_string($value) && $value !== '' ? $value : null;

                if ($translations[$hash] === null && $text !== '') {
                    $expectedHash = $translationService->hash($text);

                    if ($expectedHash === $hash) {
                        $translationService->ensureExists($text);
                        $queuedCount++;
                    } else {
                        Log::warning('DynamicTranslationController: Hash mismatch for queued translation', [
                            'provided_hash' => $hash,
                            'expected_hash' => $expectedHash,
                        ]);
                    }
                }

                continue;
            }

            $translations[$hash] = null;

            if ($text === '') {
                continue;
            }

            $expectedHash = $translationService->hash($text);

            if ($expectedHash !== $hash) {
                Log::warning('DynamicTranslationController: Hash mismatch for missing translation record', [
                    'provided_hash' => $hash,
                    'expected_hash' => $expectedHash,
                ]);
                continue;
            }

            $translationService->ensureExists($text);
            $queuedCount++;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'locale' => $locale,
                'translations' => $translations,
                'queued' => $queuedCount,
            ],
        ]);
    }
}
