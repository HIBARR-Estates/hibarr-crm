<?php

namespace App\Http\Controllers;

use App\Services\I18nTranslationService;
use Illuminate\Http\JsonResponse;

class I18nController extends Controller
{
    public function __construct(
        private I18nTranslationService $i18n
    ) {
    }

    /**
     * Return flattened translation dictionaries for the given locale.
     */
    public function show(string $locale): JsonResponse
    {
        $payload = $this->i18n->payloadForLocale($locale);

        return response()
            ->json($payload)
            // Dictionaries are locale-scoped (not user-specific); private keeps
            // shared proxies from caching an auth-gated response.
            // no-cache: always revalidate so newly added lang keys (e.g. product
            // tours) show up after translations:clear without waiting an hour.
            // The expensive flatten still lives in Cache::remember server-side.
            ->header('Cache-Control', 'private, no-cache');
    }
}
