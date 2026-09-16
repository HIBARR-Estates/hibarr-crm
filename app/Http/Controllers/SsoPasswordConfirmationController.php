<?php

namespace App\Http\Controllers;

use Exception;
use App\Models\User;
use App\Support\SsoReauthentication;
use App\Traits\SocialAuthSettings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

/**
 * Lets a signed-in user confirm their identity with their social provider
 * instead of their local password. SSO-only users often don't know the local
 * password, which would otherwise lock them out of their 2FA settings.
 *
 * The provider sends the user back to the usual social callback route, so no
 * extra redirect URI has to be registered with the identity provider.
 */
class SsoPasswordConfirmationController extends Controller
{

    use SocialAuthSettings;

    public const SESSION_KEY = 'sso_password_confirm';

    /**
     * How long the user has to complete the round-trip.
     */
    private const TIMEOUT_MINUTES = 10;

    public function __construct()
    {
        parent::__construct();
        $this->middleware('auth');
    }

    /**
     * Remember what the user was about to do and hand them to the provider.
     */
    public function redirect(Request $request)
    {
        $request->validate([
            'method' => 'required|in:email,google_authenticator,recovery_codes',
            'status' => 'required|in:enable,disable,regenerate',
        ]);

        /** @var User $user */
        $user = Auth::user();
        $provider = SsoReauthentication::providerFor($user);

        abort_403(is_null($provider));

        session()->put(self::SESSION_KEY, [
            'user_id' => $user->id,
            'provider' => $provider,
            'method' => $request->method,
            'status' => $request->status,
            'expires_at' => now()->addMinutes(self::TIMEOUT_MINUTES)->getTimestamp(),
        ]);

        $this->setSocailAuthConfigs();

        // prompt=login / max_age=0 ask the provider to re-authenticate the user
        // rather than replaying an existing provider session.
        return Socialite::driver($provider) /* @phpstan-ignore-line */
            ->with(['prompt' => 'login', 'max_age' => 0])
            ->redirect();
    }

    /**
     * Called from the shared social callback when a confirmation is pending.
     */
    public function confirm(string $provider)
    {
        $pending = session()->pull(self::SESSION_KEY);
        $redirect = redirect(route('security-settings.index'));

        if (!$this->pendingIsValid($pending, $provider)) {
            return $redirect->with('message', __('messages.ssoConfirmationFailed'));
        }

        // LoginController hands over before it configures the drivers, and the
        // token exchange below needs the credentials from the social settings.
        $this->setSocailAuthConfigs();

        try {
            $data = Socialite::driver($provider)->stateless()->user(); /* @phpstan-ignore-line */
        } catch (Exception $e) {
            Log::error('SSO password confirmation failed', ['provider' => $provider, 'error' => $e->getMessage()]);

            return $redirect->with('message', __('messages.ssoConfirmationFailed'));
        }

        /** @var User $user */
        $user = Auth::user();

        if (!SsoReauthentication::identityMatches($user, $provider, $data->id ?? null)) {
            Log::warning('SSO password confirmation identity mismatch', [
                'provider' => $provider,
                'user_id' => Auth::id(),
            ]);

            return $redirect->with('message', __('messages.ssoConfirmationFailed'));
        }

        // Same session key Fortify writes, so the confirmation window applies
        // to every password-confirmed route, not just the pending action.
        session()->put('auth.password_confirmed_at', time());

        return $redirect->with('two_fa_resume', [
            'method' => $pending['method'],
            'status' => $pending['status'],
        ]);
    }

    private function pendingIsValid($pending, string $provider): bool
    {
        return is_array($pending)
            && Auth::check()
            && ($pending['user_id'] ?? null) === Auth::id()
            && ($pending['provider'] ?? null) === $provider
            && ($pending['expires_at'] ?? 0) >= time();
    }

}
