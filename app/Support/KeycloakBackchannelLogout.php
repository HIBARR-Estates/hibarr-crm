<?php

namespace App\Support;

use App\Models\Social;
use App\Models\SocialAuthSetting;
use App\Models\User;
use App\Traits\SocialAuthSettings;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

/**
 * OIDC back-channel logout for the CRM.
 *
 * When a user signs out of any HIBARR app, Keycloak POSTs a signed
 * `logout_token` here. The Laravel session (120 minutes) would otherwise
 * outlive the Keycloak session, so the CRM stayed signed in after the user
 * signed out elsewhere.
 *
 * At login the Keycloak session id (`sid`) is stored in the Laravel session
 * ({@see rememberLogin}). A logout token records that `sid` (or, when it names
 * only the user, the user's `sub` and the time) as revoked in the cache, and
 * `EnsureKeycloakSessionActive` ends any session that matches on its next
 * request. Checking a revocation list, rather than mapping Keycloak sessions to
 * Laravel session ids, works with every session driver and survives the session
 * id regeneration at login.
 *
 * The user's "remember me" token is rotated too: otherwise the recaller cookie
 * would sign the user straight back in without Keycloak.
 */
class KeycloakBackchannelLogout
{
    use SocialAuthSettings;

    /** `events` member that marks a token as a back-channel logout token. */
    public const EVENT = 'http://schemas.openid.net/event/backchannel-logout';

    public const SESSION_SID_KEY = 'sso.keycloak_sid';
    public const SESSION_SUB_KEY = 'sso.keycloak_sub';
    public const SESSION_AUTHENTICATED_AT_KEY = 'sso.authenticated_at';

    private const REVOKED_SID_PREFIX = 'sso:revoked-sid:';
    private const REVOKED_SUB_PREFIX = 'sso:revoked-sub:';
    private const JTI_PREFIX = 'sso:logout-jti:';
    private const JWKS_CACHE_KEY = 'sso:keycloak-jwks';

    /** Logout tokens older (or newer) than this are rejected, limiting replay. */
    private const MAX_SKEW_SECONDS = 300;
    private const JTI_TTL_SECONDS = 600;
    private const JWKS_TTL_SECONDS = 600;

    /**
     * Validate a logout token and end the matching sessions.
     *
     * @throws InvalidLogoutToken when the token is not a valid logout token.
     */
    public static function handle(string $logoutToken): void
    {
        (new self)->process($logoutToken);
    }

    /**
     * Store the Keycloak session identifiers of the login that just happened.
     * The id_token comes straight from Keycloak's token endpoint, so its claims
     * are only used to look the session up later, never to authorize anything.
     */
    public static function rememberLogin(Session $session, ?string $idToken): void
    {
        $claims = self::unverifiedClaims($idToken);

        foreach ([self::SESSION_SID_KEY => 'sid', self::SESSION_SUB_KEY => 'sub'] as $key => $claim) {
            if (! empty($claims[$claim]) && is_string($claims[$claim])) {
                $session->put($key, $claims[$claim]);
            } else {
                // Never keep a previous login's identifiers for this one.
                $session->forget($key);
            }
        }

        $session->put(self::SESSION_AUTHENTICATED_AT_KEY, time());
    }

    /**
     * Whether the Keycloak session this Laravel session came from has ended.
     * Sessions created before this feature carry no identifiers and are left
     * alone; they age out with the session lifetime.
     */
    public static function sessionRevoked(Session $session): bool
    {
        $sid = $session->get(self::SESSION_SID_KEY);
        $sub = $session->get(self::SESSION_SUB_KEY);

        if (! $sid && ! $sub) {
            return false;
        }

        if ($sid && Cache::has(self::REVOKED_SID_PREFIX.$sid)) {
            return true;
        }

        if (! $sub) {
            return false;
        }

        $revokedAt = Cache::get(self::REVOKED_SUB_PREFIX.$sub);

        if ($revokedAt === null) {
            return false;
        }

        $authenticatedAt = $session->get(self::SESSION_AUTHENTICATED_AT_KEY);

        // No login time means it can't be proven newer than the revocation.
        return ! is_numeric($authenticatedAt) || (int) $authenticatedAt <= (int) $revokedAt;
    }

    private function process(string $logoutToken): void
    {
        $claims = $this->verify($logoutToken);

        $sid = isset($claims->sid) && is_string($claims->sid) ? $claims->sid : null;
        $sub = isset($claims->sub) && is_string($claims->sub) ? $claims->sub : null;

        // Revoking is idempotent, so it runs before the replay claim.
        $ttl = $this->revocationTtlSeconds();

        if ($sid) {
            Cache::put(self::REVOKED_SID_PREFIX.$sid, 1, $ttl);
        } else {
            Cache::put(self::REVOKED_SUB_PREFIX.$sub, time(), $ttl);
        }

        if ($sub) {
            $this->rotateRememberToken($sub);
        }

        if (! Cache::add(self::JTI_PREFIX.$claims->jti, 1, self::JTI_TTL_SECONDS)) {
            throw new InvalidLogoutToken('Logout token was already processed.');
        }
    }

    /**
     * Back-channel logout tokens are validated per OIDC Back-Channel Logout 1.0 §2.6:
     * signed by the realm, from its issuer, addressed to this client, carrying the
     * back-channel-logout event and no nonce, naming a session and/or user, with a
     * jti and a recent iat.
     */
    private function verify(string $logoutToken): object
    {
        $issuer = $this->issuer();
        $clientId = (string) config('services.keycloak.client_id');

        if ($issuer === null || $clientId === '') {
            throw new InvalidLogoutToken('Keycloak is not configured.');
        }

        $claims = $this->decode($logoutToken);

        if (($claims->iss ?? null) !== $issuer) {
            throw new InvalidLogoutToken('Unexpected issuer.');
        }

        if (! in_array($clientId, (array) ($claims->aud ?? []), true)) {
            throw new InvalidLogoutToken('Logout token is not addressed to this client.');
        }

        $events = (array) ($claims->events ?? []);
        if (! array_key_exists(self::EVENT, $events)) {
            throw new InvalidLogoutToken('Not a back-channel logout token.');
        }

        // A logout token must not be usable as an ID token.
        if (property_exists($claims, 'nonce')) {
            throw new InvalidLogoutToken('Logout token must not contain a nonce.');
        }

        if (empty($claims->sid) && empty($claims->sub)) {
            throw new InvalidLogoutToken('Logout token identifies no session or user.');
        }

        if (empty($claims->jti) || ! is_string($claims->jti)) {
            throw new InvalidLogoutToken('Logout token has no jti.');
        }

        if (! isset($claims->iat) || ! is_numeric($claims->iat)
            || abs(time() - (int) $claims->iat) > self::MAX_SKEW_SECONDS) {
            throw new InvalidLogoutToken('Logout token is not recent.');
        }

        return $claims;
    }

    private function decode(string $logoutToken): object
    {
        $previousLeeway = JWT::$leeway;
        JWT::$leeway = self::MAX_SKEW_SECONDS;

        try {
            try {
                return JWT::decode($logoutToken, JWK::parseKeySet($this->jwks(false), 'RS256'));
            } catch (Throwable $e) {
                // Keycloak may have rotated its signing keys: retry once with fresh ones.
                return JWT::decode($logoutToken, JWK::parseKeySet($this->jwks(true), 'RS256'));
            }
        } catch (Throwable $e) {
            throw new InvalidLogoutToken('Invalid logout token.', 0, $e);
        } finally {
            JWT::$leeway = $previousLeeway;
        }
    }

    private function jwks(bool $refresh): array
    {
        if ($refresh) {
            Cache::forget(self::JWKS_CACHE_KEY);
        }

        return Cache::remember(self::JWKS_CACHE_KEY, self::JWKS_TTL_SECONDS, function () {
            $response = Http::timeout(5)->get($this->issuer().'/protocol/openid-connect/certs');
            $response->throw();

            return $response->json();
        });
    }

    /** Realm issuer URL, or null when Keycloak isn't configured. */
    private function issuer(): ?string
    {
        if (is_null(SocialAuthSetting::first())) {
            return null;
        }

        $this->setSocailAuthConfigs();

        $baseUrl = rtrim((string) config('services.keycloak.base_url'), '/');
        $realm = (string) config('services.keycloak.realms');

        if ($baseUrl === '' || $realm === '') {
            return null;
        }

        return $baseUrl.'/realms/'.rawurlencode($realm);
    }

    /** Revocations must outlive every Laravel session they could match. */
    private function revocationTtlSeconds(): int
    {
        return max((int) config('session.lifetime'), 1) * 60 + 300;
    }

    /**
     * The user's remember-me cookie would otherwise sign them straight back in.
     * This also ends the user's remember-me logins in other browsers.
     */
    private function rotateRememberToken(string $sub): void
    {
        $userId = Social::withoutGlobalScopes()
            ->where('social_service', 'keycloak')
            ->where('social_id', $sub)
            ->value('user_id');

        if (! $userId) {
            return;
        }

        $user = User::withoutGlobalScopes()->find($userId);

        if ($user) {
            $user->setRememberToken(Str::random(60));
            $user->saveQuietly();
        }
    }

    private static function unverifiedClaims(?string $jwt): array
    {
        $parts = explode('.', (string) $jwt);

        if (count($parts) !== 3) {
            return [];
        }

        $payload = json_decode((string) base64_decode(strtr($parts[1], '-_', '+/')), true);

        return is_array($payload) ? $payload : [];
    }
}
