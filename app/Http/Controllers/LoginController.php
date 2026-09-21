<?php

namespace App\Http\Controllers;

use Exception;
use App\Models\User;
use App\Helper\Reply;
use App\Models\Social;
use Illuminate\Http\Request;
use Laravel\Fortify\Fortify;
use App\Events\TwoFactorCodeEvent;
use App\Traits\SocialAuthSettings;
use Froiden\Envato\Traits\AppBoot;
use Illuminate\Support\Facades\DB;
use App\Http\Requests\LoginRequest;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use \Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;

class LoginController extends Controller
{

    use AppBoot, SocialAuthSettings;

    protected $redirectTo = 'account/dashboard';

    public function __construct()
    {
        parent::__construct();

        // Limiters are defined in RouteServiceProvider::configureRateLimiting().
        $this->middleware('throttle:login-email-check')->only('checkEmail');
        $this->middleware('throttle:two-factor-code')->only(['checkCode', 'resendCode']);
    }

    public function checkEmail(LoginRequest $request)
    {
        // Same answer whether or not the address has an active account, so this
        // step can't be used to discover accounts. The password step rejects
        // unknown addresses with Fortify's generic failed-login message.
        return response([
            'status' => 'success'
        ]);
    }

    public function checkCode(Request $request)
    {
        $request->validate([
            'code' => 'required',
        ]);

        // The challenge belongs to whoever passed the password step in this
        // session (RedirectIfTwoFactorAuthenticatable sets login.id) — never
        // to a user id sent by the browser.
        $user = User::find($request->session()->get('login.id'));

        if (is_null($user)) {
            return redirect()->route('login');
        }

        if ($user->hasValidTwoFactorCode((string) $request->code)) {

            // Reset codes and expire_at after verification
            $user->resetTwoFactorCode();
            $request->session()->forget(['login.id', 'login.remember', 'login.authenticate_via']);

            // Attempt login
            Auth::login($user);
            $request->session()->regenerate();

            return redirect()->route('dashboard');
        }

        // Reset codes and expire_at after failure
        $user->resetTwoFactorCode();

        return redirect()->back()->withErrors(['two_factor_code' => __('messages.codeNotMatch')]);
    }

    public function resendCode(Request $request)
    {
        $user = User::find($request->session()->get('login.id'));

        if (is_null($user)) {
            return Reply::error(__('messages.unAuthorisedUser'));
        }

        $user->generateTwoFactorCode();
        event(new TwoFactorCodeEvent($user));

        return Reply::success(__('messages.codeSent'));
    }

    public function redirect($provider)
    {
        // Keycloak SSO is the only supported way to sign in to the CRM,
        // and it can't be disabled (Social Login Settings forces it on).
        if ($provider !== 'keycloak') {
            abort(404);
        }

        $this->setSocailAuthConfigs();

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, $provider)
    {
        // Keycloak SSO is the only supported way to sign in to the CRM,
        // and it can't be disabled (Social Login Settings forces it on).
        if ($provider !== 'keycloak') {
            abort(404);
        }

        // A pending SSO password confirmation reuses this callback so the
        // provider needs no extra redirect URI registered.
        if (session()->has(SsoPasswordConfirmationController::SESSION_KEY)) {
            return app(SsoPasswordConfirmationController::class)->confirm($provider);
        }

        // Query string carries the OAuth code — kept out of the log.
        Log::info("Social login callback started", ['provider' => $provider]);

        $this->setSocailAuthConfigs();

        Log::info("Social auth configs set", [
            'keycloak_base_url' => config('services.keycloak.base_url'),
            'keycloak_realm' => config('services.keycloak.realms'),
            'keycloak_client_id' => config('services.keycloak.client_id'),
            'keycloak_redirect' => config('services.keycloak.redirect'),
        ]);

        try {
            try {
                // Stateful on purpose: Socialite checks the OAuth state that
                // redirect() stored in the session, which blocks login CSRF.
                $data = Socialite::driver($provider)->user(); /* @phpstan-ignore-line */

                Log::info("Socialite user retrieved", [
                    'provider' => $provider,
                    'social_id' => $data->id ?? null,
                    'email' => $data->email ?? null,
                    'name' => $data->name ?? null,
                ]);
            } catch (Exception $e) {
                Log::error("Socialite driver exception", [
                    'provider' => $provider,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return redirect()->route('login')->with(['message' => $e->getMessage()]);
            }

            $user = $this->findSocialLoginUser($provider, $data);

            Log::info("User lookup result", [
                'provider' => $provider,
                'lookup_email' => $data->email ?? null,
                'user_found' => !is_null($user),
                'user_id' => $user->id ?? null,
                'user_status' => $user->status ?? null,
                'user_login' => $user->login ?? null,
                'user_admin_approval' => $user->admin_approval ?? null,
            ]);

            if (!$user) {
                Log::warning("Social login: user not found", ['email' => $data->email]);
                return redirect()->route('login')->with(['message' => __('messages.unAuthorisedUser')]);
            }

            if ($user->status === 'deactive') {
                Log::warning("Social login: user deactive", ['user_id' => $user->id]);
                return redirect()->route('login')->with(['message' => __('auth.failedBlocked')]);
            }

            if ($user->login === 'disable') {
                Log::warning("Social login: user login disabled", ['user_id' => $user->id]);
                return redirect()->route('login')->with(['message' => __('auth.failedLoginDisabled')]);
            }

            // User found
            DB::beginTransaction();

            try {
                Social::updateOrCreate(['user_id' => $user->id], [
                    'social_id' => $data->id,
                    'social_service' => $provider,
                ]);

                DB::commit();
            } catch (Exception $e) {
                DB::rollBack();

                throw $e;
            }

            Log::info("Social record saved, logging in user", ['user_id' => $user->id]);

            Auth::login($user, true);

            $redirectPath = $this->redirectPath();
            Log::info("Auth::login complete, redirecting", [
                'user_id' => $user->id,
                'auth_check' => Auth::check(),
                'redirect_path' => $redirectPath,
                'intended_url' => session()->get('url.intended'),
            ]);

            return redirect()->intended($redirectPath);

        } catch (Exception $e) {
            Log::error('Social login error', [
                'provider' => $provider,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->route('login')->with(['message' => $e->getMessage()]);
        }
      
    }

    /**
     * Resolve the local account for a provider identity. An identity linked on
     * an earlier login signs straight in; otherwise the provider's email is only
     * trusted when the provider asserts it is verified.
     */
    private function findSocialLoginUser(string $service, $data): ?User
    {
        $linkedUserId = Social::where('social_service', $service)
            ->where('social_id', (string) $data->id)
            ->value('user_id');

        if ($linkedUserId) {
            return User::where('id', $linkedUserId)->first();
        }

        $raw = $data->getRaw();
        $emailVerified = filter_var($raw['email_verified'] ?? $raw['verified_email'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (!$emailVerified || empty($data->email)) {
            Log::warning("Social login: unlinked identity without a verified email", ['provider' => $service]);

            return null;
        }

        return User::where(['email' => $data->email])->first();
    }

    public function redirectPath()
    {
        if (method_exists($this, 'redirectTo')) {
            return $this->redirectTo();
        }

        return property_exists($this, 'redirectTo') ? $this->redirectTo : '/login';
    }

    public function username()
    {
        return 'email';
    }

}
