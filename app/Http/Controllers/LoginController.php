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

    public function checkEmail(LoginRequest $request)
    {
        $user = User::where('email', $request->email)
            ->select('id')
            ->where('status', 'active')
            ->where('login', 'enable')
            ->first();

        if (is_null($user)) {
            throw ValidationException::withMessages([
                Fortify::username() => __('messages.invalidOrInactiveAccount'),
            ]);
        }

        return response([
            'status' => 'success'
        ]);
    }

    public function checkCode(Request $request)
    {
        $request->validate([
            'code' => 'required',
        ]);

        $user = User::findOrFail($request->user_id);

        if ($request->code == $user->two_factor_code) {

            // Reset codes and expire_at after verification
            $user->resetTwoFactorCode();

            // Attempt login
            Auth::login($user);

            return redirect()->route('dashboard');
        }

        // Reset codes and expire_at after failure
        $user->resetTwoFactorCode();

        return redirect()->back()->withErrors(['two_factor_code' => __('messages.codeNotMatch')]);
    }

    public function resendCode(Request $request)
    {
        $user = User::findOrFail($request->user_id);
        $user->generateTwoFactorCode();
        event(new TwoFactorCodeEvent($user));

        return Reply::success(__('messages.codeSent'));
    }

    public function redirect($provider)
    {
        $this->setSocailAuthConfigs();

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, $provider)
    {
        Log::info("Social login callback started", ['provider' => $provider, 'query' => $request->query()]);

        $this->setSocailAuthConfigs();

        Log::info("Social auth configs set", [
            'keycloak_base_url' => config('services.keycloak.base_url'),
            'keycloak_realm' => config('services.keycloak.realms'),
            'keycloak_client_id' => config('services.keycloak.client_id'),
            'keycloak_redirect' => config('services.keycloak.redirect'),
        ]);

        try {
            try {
                if ($provider != 'twitter' && $provider != 'linkedin') {
                    $data = Socialite::driver($provider)->stateless()->user(); /* @phpstan-ignore-line */
                }
                elseif ($provider == 'twitter') {
                    $data = Socialite::driver('twitter-oauth-2')->user(); /* @phpstan-ignore-line */
                }
                elseif ($provider == 'linkedin') {
                    $data = Socialite::driver('linkedin-openid')->user(); /* @phpstan-ignore-line */
                }
                else {
                    $data = Socialite::driver($provider)->user();
                }

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

            if ($provider == 'twitter') {
                $user = User::where(['twitter_id' => $data->id])->first();
            }
            else {
                $user = User::where(['email' => $data->email])->first();
            }

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

            Social::updateOrCreate(['user_id' => $user->id], [
                'social_id' => $data->id,
                'social_service' => $provider,
            ]);

            DB::commit();

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
