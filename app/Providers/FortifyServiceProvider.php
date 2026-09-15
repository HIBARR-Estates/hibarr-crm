<?php

namespace App\Providers;

use Carbon\Carbon;
use App\Models\Company;
use Illuminate\Http\Request;
use Laravel\Fortify\Fortify;
use App\Models\GlobalSetting;
use Laravel\Fortify\Features;
use Froiden\Envato\Traits\AppBoot;
use Illuminate\Support\Facades\App;
use App\Actions\Fortify\CreateNewUser;
use Illuminate\Support\ServiceProvider;
use App\Actions\Fortify\UpdateUserPassword;
use Laravel\Fortify\Contracts\LogoutResponse;
use App\Actions\Fortify\AttemptToAuthenticate;
use Illuminate\Validation\ValidationException;
use App\Actions\Fortify\RedirectIfTwoFactorConfirmed;
use App\Actions\Fortify\UpdateUserProfileInformation;
use Laravel\Fortify\Actions\EnsureLoginIsNotThrottled;
use Laravel\Fortify\Actions\PrepareAuthenticatedSession;

class FortifyServiceProvider extends ServiceProvider
{

    use AppBoot;

    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        $this->app->instance(LogoutResponse::class, new class implements LogoutResponse {

            public function toResponse($request)
            {
                session()->flush();
                return redirect()->route('login');
            }

        });
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        if (request()->has('locale')){
            App::setLocale(request()->locale);
        }

        Fortify::authenticateThrough(function (Request $request) {

            return array_filter([
                config('fortify.limiters.login') ? null : EnsureLoginIsNotThrottled::class,
                Features::enabled(Features::twoFactorAuthentication()) ? RedirectIfTwoFactorConfirmed::class : null,
                AttemptToAuthenticate::class,
                PrepareAuthenticatedSession::class,
            ]);
        });
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
        Fortify::updateUserPasswordsUsing(UpdateUserPassword::class);

        // Fortify::authenticateThrough();
        // Email/password authentication is disabled: Keycloak SSO (see
        // LoginController::redirect/callback) is the only supported way to
        // sign in to the CRM. This callback always denies the credentials
        // so the POST /login endpoint can never establish a session.
        Fortify::authenticateUsing(function (Request $request) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        });


        Fortify::loginView(function () {

            $this->showInstall();

            $this->checkMigrateStatus();
            $globalSetting = global_setting();
            // Is worksuite
            $company = Company::withCount('users')->first();

            // if (!$this->isLegal()) {
            //     return redirect('verify-purchase');
            // }

            App::setLocale($globalSetting->locale);
            Carbon::setLocale($globalSetting->locale);
            setlocale(LC_TIME, $globalSetting->locale . '_' . mb_strtoupper($globalSetting->locale));

            $userTotal = $company?->users_count;

            if ($userTotal == 0) {
                return view('auth.account_setup', ['global' => $globalSetting, 'setting' => $globalSetting]);
            }

            $socialAuthSettings = social_auth_setting();
            $languages = language_setting();

            return view('auth.login', [
                'globalSetting' => $globalSetting,
                'socialAuthSettings' => $socialAuthSettings,
                'company' => $company,
                'languages' => $languages,
            ]);

        });

        Fortify::confirmPasswordView(function ($request) {
            $globalSetting = GlobalSetting::first();
            App::setLocale($globalSetting->locale);
            Carbon::setLocale($globalSetting->locale);
            setlocale(LC_TIME, $globalSetting->locale . '_' . mb_strtoupper($globalSetting->locale));

            return view('auth.password-confirm', ['request' => $request, 'globalSetting' => $globalSetting]);
        });

        Fortify::twoFactorChallengeView(function () {
            $globalSetting = GlobalSetting::first();
            App::setLocale($globalSetting->locale);
            Carbon::setLocale($globalSetting->locale);
            setlocale(LC_TIME, $globalSetting->locale . '_' . mb_strtoupper($globalSetting->locale));

            return view('auth.two-factor-challenge', ['globalSetting' => $globalSetting]);
        });

        Fortify::registerView(function () {

            // ISWORKSUITE
            $company = Company::first();
            $globalSetting = GlobalSetting::first();

            if (!$company->allow_client_signup) {
                return redirect(route('login'));
            }

            App::setLocale($globalSetting->locale);
            Carbon::setLocale($globalSetting->locale);
            setlocale(LC_TIME, $globalSetting->locale . '_' . mb_strtoupper($globalSetting->locale));

            return view('auth.register', ['globalSetting' => $globalSetting]);

        });

    }

    public function checkMigrateStatus()
    {
        return check_migrate_status();
    }

}
