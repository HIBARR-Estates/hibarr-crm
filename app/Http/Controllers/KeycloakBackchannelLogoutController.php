<?php

namespace App\Http\Controllers;

use App\Support\InvalidLogoutToken;
use App\Support\KeycloakBackchannelLogout;
use Illuminate\Http\Request;

/**
 * Receives Keycloak's OIDC back-channel logout request. Authenticated by the
 * signature of the logout token, not by a session or CSRF token.
 */
class KeycloakBackchannelLogoutController extends Controller
{
    public function __invoke(Request $request)
    {
        $logoutToken = $request->input('logout_token');

        try {
            if (! is_string($logoutToken) || $logoutToken === '') {
                throw new InvalidLogoutToken('logout_token is required.');
            }

            KeycloakBackchannelLogout::handle($logoutToken);
        } catch (InvalidLogoutToken $e) {
            return response()
                ->json(['error' => 'invalid_request', 'error_description' => $e->getMessage()], 400)
                ->header('Cache-Control', 'no-store');
        }

        return response('', 200)->header('Cache-Control', 'no-store');
    }
}
