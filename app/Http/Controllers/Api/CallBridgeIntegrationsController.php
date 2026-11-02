<?php

namespace App\Http\Controllers\Api;

use App\Support\FeatureFlags;
use App\Support\SipProviderRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Http\Request;

/**
 * CallBridge SIP Provider Integrations API
 *
 * Endpoints:
 *   GET /api/v1/call-bridge/integrations/providers
 *   GET /api/v1/call-bridge/integrations/providers/{platform}
 *
 * Feature flag: callbridge.integrations gates the entire CallBridge domain.
 * Authentication is handled by the api.token.or.session middleware on the routes.
 */
class CallBridgeIntegrationsController extends Controller
{
    /**
     * GET /api/v1/call-bridge/integrations/providers
     *
     * Returns the list of supported CallBridge SIP providers.
     *
     * Response 200:
     * {
     *   "status": "success",
     *   "data": {
     *     "providers": ["sipgate"]
     *   }
     * }
     *
     * Response 404 if callbridge.integrations feature flag is disabled.
     */
    public function providers(Request $request): JsonResponse
    {
        // Gate the entire CallBridge domain behind the feature flag
        if (! FeatureFlags::enabled('callbridge.integrations')) {
            abort(404, 'CallBridge integrations feature flag is disabled.');
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'providers' => SipProviderRegistry::names(),
            ],
        ]);
    }

    /**
     * GET /api/v1/call-bridge/integrations/providers/{platform}
     *
     * Returns SIP connection defaults for the given platform.
     *
     * Path param:
     *   platform - One of the values returned by /providers (currently sipgate)
     *
     * Response 200:
     * {
     *   "status": "success",
     *   "data": {
     *     "wss": "wss://sip.sipgate.de",
     *     "sipUriFormat": "sip:{username}@sipgate.de"
     *   }
     * }
     *
     * Error responses:
     *   400 — invalid platform (validated by callBridgeProviderPlatforms schema)
     *   401 — missing credentials
     *   403 — API key not permitted / OIDC caller lacks permission
     */
    public function platform(Request $request, string $platform): JsonResponse
    {
        // Gate the entire CallBridge domain behind the feature flag
        if (! FeatureFlags::enabled('callbridge.integrations')) {
            abort(404, 'CallBridge integrations feature flag is disabled.');
        }

        // Validate platform
        $defaults = SipProviderRegistry::defaults($platform);

        if ($defaults === null) {
            abort(400, "Invalid platform: {$platform}.");
        }

        return response()->json([
            'status' => 'success',
            'data' => $defaults,
        ]);
    }
}