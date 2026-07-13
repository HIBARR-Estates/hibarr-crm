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
            ->header('Cache-Control', 'private, max-age=3600');
    }
}
