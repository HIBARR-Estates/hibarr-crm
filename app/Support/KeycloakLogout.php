<?php

namespace App\Support;

use App\Models\SocialAuthSetting;
use App\Traits\SocialAuthSettings;

/**
 * Builds the Keycloak end-session URL used to log a user out of Keycloak as
 * well as the CRM. Without it the Keycloak SSO session outlives the CRM
 * session, and the login page's "Sign in with Keycloak" button silently signs
 * the user straight back in — they can never log out.
 */
class KeycloakLogout
{
    use SocialAuthSettings;

    /** Session key holding the OIDC id_token captured at login. */
    public const ID_TOKEN_SESSION_KEY = 'sso.keycloak_id_token';

    /** Request attribute carrying the URL from the Logout event to the response. */
    public const REQUEST_ATTRIBUTE = 'sso_logout_url';

    /**
     * End-session URL, or null when Keycloak isn't configured.
     *
     * `id_token_hint` lets Keycloak end the session without a confirmation
     * screen, but Keycloak rejects an expired hint ("Invalid parameter:
     * id_token_hint") and ID tokens only live a few minutes, so it is only sent
     * while still valid. Without it, `client_id` + `post_logout_redirect_uri`
     * make Keycloak show a one-click logout confirmation instead of failing.
     * `post_logout_redirect_uri` must be listed under the client's
     * "Valid post logout redirect URIs" in Keycloak.
     */
    public static function url(?string $idToken): ?string
    {
        return (new self)->buildUrl($idToken);
    }

    private function buildUrl(?string $idToken): ?string
    {
        if (is_null(SocialAuthSetting::first())) {
            return null;
        }

        $this->setSocailAuthConfigs();

        $baseUrl = rtrim((string) config('services.keycloak.base_url'), '/');
        $realm = (string) config('services.keycloak.realms');
        $clientId = (string) config('services.keycloak.client_id');

        if ($baseUrl === '' || $realm === '') {
            return null;
        }

        $query = [
            'post_logout_redirect_uri' => config('services.keycloak.post_logout_redirect')
                ?: $this->updateMainAppUrl(route('login')),
            'client_id' => $clientId,
        ];

        if (self::isUnexpired($idToken)) {
            $query['id_token_hint'] = $idToken;
        }

        return $baseUrl.'/realms/'.rawurlencode($realm).'/protocol/openid-connect/logout?'
            .http_build_query(array_filter($query), '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * Whether the JWT's `exp` claim is still in the future (with a small
     * margin for the redirect). Only reads the payload — Keycloak does the
     * real verification.
     */
    private static function isUnexpired(?string $jwt): bool
    {
        if (! $jwt) {
            return false;
        }

        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return false;
        }

        $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);

        return is_array($payload)
            && isset($payload['exp'])
            && (int) $payload['exp'] > time() + 30;
    }
}
