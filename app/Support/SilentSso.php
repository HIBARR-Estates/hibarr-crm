<?php

namespace App\Support;

use Illuminate\Contracts\Session\Session;
use Illuminate\Http\Request;

/**
 * Silent single sign-on. Spec: hibarr-os docs/architecture/silent-sso.md (HIB-1859).
 *
 * A guest on a protected page is sent to Keycloak with `prompt=none`. If the user is
 * signed in to another HIBARR app they come back signed in and land on the page they
 * asked for. If Keycloak has no session it answers `login_required` and the login
 * page is shown. A short-lived session marker makes sure a failed attempt can never loop.
 */
class SilentSso
{
    public const SESSION_KEY = 'sso.silent_attempt_at';

    /** A failed silent attempt is not retried for this long. */
    public const WINDOW_SECONDS = 60;

    /** Keycloak answers a `prompt=none` request with one of these when the user has to sign in. */
    private const DECLINED_ERRORS = ['login_required', 'interaction_required', 'consent_required'];

    /** Per-app flag. Off = today's behaviour (the login page with a button). */
    public static function enabled(): bool
    {
        return (bool) config('services.keycloak.silent_sso', false);
    }

    /** Whether a guest's request should be sent through the silent sign-in instead of the login page. */
    public static function shouldAttempt(Request $request): bool
    {
        return self::enabled()
            && $request->isMethod('GET')
            && ! $request->expectsJson()
            && ! $request->ajax()
            && self::canAttempt($request->session());
    }

    /** False while a previous silent attempt in this session is younger than the window. */
    public static function canAttempt(Session $session, ?int $now = null): bool
    {
        $startedAt = $session->get(self::SESSION_KEY);

        if (! is_numeric($startedAt)) {
            return true;
        }

        return ($now ?? time()) - (int) $startedAt >= self::WINDOW_SECONDS;
    }

    public static function markAttempt(Session $session, ?int $now = null): void
    {
        $session->put(self::SESSION_KEY, $now ?? time());
    }

    /** True when Keycloak says it has no session for this user: show the login page, with no error. */
    public static function isDeclined(?string $error): bool
    {
        return $error !== null && in_array($error, self::DECLINED_ERRORS, true);
    }
}
