<?php

namespace App\Http\Controllers\Api;

use App\Services\CallBridge\CallBridgeClient;
use App\Support\FeatureFlags;
use App\Support\SipProviderRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * CallBridge SIP Provider Integrations API
 *
 * Endpoints:
 *   GET /api/v1/call-bridge/integrations/providers
 *   GET /api/v1/call-bridge/integrations/providers/{platform}
 *
 * OL is the source of truth for the supported SIP platforms — it exposes the
 * same contract at `/v1/call-bridge/integrations/providers` behind an
 * `x-api-key` header. The CRM reads it through the configured call bridge
 * connection (config `services.call_bridge.*`) and re-exposes it here for the
 * browser (session cookie) and services (API token), so no key ever reaches
 * client code. When the bridge is not configured, or OL cannot be reached,
 * the local SipProviderRegistry is served instead so the settings form keeps
 * working.
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
                'providers' => $this->resolveProviders(),
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
     *   400 — unknown platform (rejected by OL, or unknown to the local
     *         registry when OL is unavailable)
     *   401 — missing credentials
     *   403 — API key not permitted / OIDC caller lacks permission
     */
    public function platform(Request $request, string $platform): JsonResponse
    {
        // Gate the entire CallBridge domain behind the feature flag
        if (! FeatureFlags::enabled('callbridge.integrations')) {
            abort(404, 'CallBridge integrations feature flag is disabled.');
        }

        $defaults = $this->resolveDefaults($platform);

        if ($defaults === null) {
            abort(400, "Invalid platform: {$platform}.");
        }

        return response()->json([
            'status' => 'success',
            'data' => $defaults,
        ]);
    }

    /**
     * Supported platforms: OL when it answers, the local registry otherwise.
     *
     * @return array<int, string>
     */
    private function resolveProviders(): array
    {
        $client = $this->bridge();

        if ($client !== null) {
            try {
                $providers = $client->fetchSipProviders();

                if ($providers !== []) {
                    return $providers;
                }
            } catch (\Throwable $e) {
                Log::warning('CallBridgeIntegrations: OL provider list unavailable; serving the local registry.', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return SipProviderRegistry::names();
    }

    /**
     * Connection defaults for one platform: OL when it answers, the local
     * registry otherwise. Null means the platform is unknown to both, which
     * the caller reports as a 400.
     *
     * @return array{wss: string, sipUriFormat: string}|null
     */
    private function resolveDefaults(string $platform): ?array
    {
        $client = $this->bridge();

        if ($client !== null) {
            try {
                $defaults = $client->fetchSipPlatformDefaults($platform);

                if ($defaults !== null) {
                    return $defaults;
                }
            } catch (\Throwable $e) {
                Log::warning('CallBridgeIntegrations: OL platform defaults unavailable; serving the local registry.', [
                    'platform' => $platform,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return SipProviderRegistry::defaults($platform);
    }

    /** The OL call bridge connection, when it is configured at all. */
    private function bridge(): ?CallBridgeClient
    {
        $client = app(CallBridgeClient::class);

        return $client->configured() ? $client : null;
    }
}
