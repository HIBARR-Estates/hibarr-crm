<?php

namespace App\Support\AuditLog;

use Illuminate\Auth\Events\Login;

/**
 * What a sign-in or sign-out actually was.
 *
 * A sign-in is a person authenticating: single sign-on, a password, a
 * verification code, or a brand-new account. Coming back on a remembered
 * browser is recorded separately, as a restored session. A sign-out is that
 * session ending because they left, single sign-on ended, or the account
 * can no longer sign in. Impersonation, and a session that code rebuilds
 * for itself, are neither.
 */
final class AuthTrigger
{
    public const SSO = 'sso';

    public const PASSWORD = 'password';

    public const TWO_FACTOR = 'two_factor';

    public const REGISTRATION = 'registration';

    public const ZOHO = 'zoho';

    public const REMEMBERED_BROWSER = 'remembered_browser';

    public const USER = 'user';

    public const KEYCLOAK_SESSION_ENDED = 'keycloak_session_ended';

    public const ACCOUNT_DISABLED = 'account_disabled';

    private const ATTRIBUTE = 'audit.auth_trigger';

    public static function mark(string $trigger): void
    {
        if (! app()->bound('request')) {
            return;
        }

        request()->attributes->set(self::ATTRIBUTE, $trigger);
    }

    public static function forLogin(Login $event): ?string
    {
        $marked = self::pull();

        if ($marked !== null) {
            return $marked;
        }

        // A later visit that presents the remember-me cookie. Not a new sign-in.
        if (! app()->runningInConsole() && $event->remember) {
            return self::REMEMBERED_BROWSER;
        }

        return null;
    }

    public static function forLogout(): ?string
    {
        $marked = self::pull();

        if ($marked !== null) {
            return $marked;
        }

        if (app()->runningInConsole()) {
            return null;
        }

        return request()->route()?->getName() === 'logout' ? self::USER : null;
    }

    private static function pull(): ?string
    {
        if (! app()->bound('request')) {
            return null;
        }

        $trigger = request()->attributes->get(self::ATTRIBUTE);
        request()->attributes->remove(self::ATTRIBUTE);

        return is_string($trigger) && $trigger !== '' ? $trigger : null;
    }
}
