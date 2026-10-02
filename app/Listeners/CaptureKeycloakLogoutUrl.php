<?php

namespace App\Listeners;

use App\Support\KeycloakLogout;
use Illuminate\Auth\Events\Logout;

/**
 * The Logout event fires while the session is still intact (Fortify
 * invalidates it afterwards), so this is the last chance to read the stored
 * Keycloak tokens.
 *
 * First choice is ending the Keycloak session server-to-server with the
 * refresh token. Only when that isn't possible (no token stored — sessions
 * from before this change — or Keycloak unreachable) is the browser
 * end-session URL handed to the logout response on the request.
 */
class CaptureKeycloakLogoutUrl
{
    public function handle(Logout $event): void
    {
        if (! app()->bound('request')) {
            return;
        }

        try {
            if (KeycloakLogout::endSession(session()->get(KeycloakLogout::REFRESH_TOKEN_SESSION_KEY))) {
                return;
            }

            $url = KeycloakLogout::url(session()->get(KeycloakLogout::ID_TOKEN_SESSION_KEY));
        } catch (\Throwable $e) {
            // Never let SSO lookup break a local logout.
            report($e);

            return;
        }

        if ($url) {
            request()->attributes->set(KeycloakLogout::REQUEST_ATTRIBUTE, $url);
        }
    }
}
