<?php

namespace App\Listeners;

use App\Support\KeycloakLogout;
use Illuminate\Auth\Events\Logout;

/**
 * The Logout event fires while the session is still intact (Fortify
 * invalidates it afterwards), so this is the last chance to read the stored
 * Keycloak id_token. The URL travels to the logout response on the request.
 */
class CaptureKeycloakLogoutUrl
{
    public function handle(Logout $event): void
    {
        if (! app()->bound('request')) {
            return;
        }

        try {
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
