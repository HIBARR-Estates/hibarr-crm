<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\SsoPasswordConfirmationController;
use App\Models\Social;
use App\Models\SocialAuthSetting;
use App\Models\User;
use App\Support\SsoReauthentication;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class SsoPasswordConfirmationTest extends TestCase
{

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('socials');
        Schema::dropIfExists('social_auth_settings');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('status')->default('active');
            $table->string('login')->default('enable');
            $table->text('headers')->nullable();
            $table->text('location_details')->nullable();
            $table->timestamps();
        });

        Schema::create('socials', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('social_id')->nullable();
            $table->string('social_service')->nullable();
            $table->timestamps();
        });

        Schema::create('social_auth_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('facebook_status')->default('disable');
            $table->string('google_status')->default('disable');
            $table->string('twitter_status')->default('disable');
            $table->string('linkedin_status')->default('disable');
            $table->string('keycloak_status')->default('disable');
            $table->timestamps();
        });

        SocialAuthSetting::create(['keycloak_status' => 'enable']);
    }

    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    private function ssoUser(string $socialId = 'kc-123'): User
    {
        $user = new User();
        $user->forceFill([
            'company_id' => 1,
            'name' => 'SSO User',
            'email' => 'sso@example.test',
            'password' => bcrypt('a-password-nobody-knows'),
        ])->save();

        Social::create([
            'user_id' => $user->id,
            'social_id' => $socialId,
            'social_service' => 'keycloak',
        ]);

        return $user->refresh();
    }

    private function mockProvider(?SocialiteUser $returns): void
    {
        $driver = Mockery::mock();
        $driver->shouldReceive('stateless')->andReturnSelf();
        $driver->shouldReceive('with')->andReturnSelf();
        $driver->shouldReceive('redirect')->andReturn(redirect('https://idp.test/auth'));

        if (!is_null($returns)) {
            $driver->shouldReceive('user')->andReturn($returns);
        }

        Socialite::shouldReceive('driver')->with('keycloak')->andReturn($driver);
    }

    private function socialiteUser(string $id): SocialiteUser
    {
        $socialiteUser = new SocialiteUser();
        $socialiteUser->id = $id;
        $socialiteUser->email = 'sso@example.test';

        return $socialiteUser;
    }

    public function test_the_provider_is_offered_only_when_the_user_signs_in_with_it(): void
    {
        $user = $this->ssoUser();

        $this->assertSame('keycloak', SsoReauthentication::providerFor($user));

        SocialAuthSetting::first()->update(['keycloak_status' => 'disable']);
        $this->assertNull(SsoReauthentication::providerFor($user));

        SocialAuthSetting::first()->update(['keycloak_status' => 'enable']);
        Social::where('user_id', $user->id)->delete();
        $this->assertNull(SsoReauthentication::providerFor($user));
    }

    public function test_a_provider_the_login_callback_rejects_is_not_offered(): void
    {
        $user = $this->ssoUser();
        Social::where('user_id', $user->id)->update(['social_service' => 'google']);
        SocialAuthSetting::first()->update(['google_status' => 'enable']);

        $this->assertNull(SsoReauthentication::providerFor($user->refresh()));
    }

    public function test_a_user_without_a_social_login_cannot_start_the_sso_confirmation(): void
    {
        $user = $this->ssoUser();
        Social::where('user_id', $user->id)->delete();
        Auth::setUser($user);

        $this->expectException(HttpException::class);

        app(SsoPasswordConfirmationController::class)->redirect(
            Request::create('/sso-confirm-password', 'GET', ['method' => 'email', 'status' => 'enable'])
        );
    }

    public function test_starting_the_confirmation_stores_the_pending_action(): void
    {
        $user = $this->ssoUser();
        Auth::setUser($user);
        $this->mockProvider(null);

        app(SsoPasswordConfirmationController::class)->redirect(
            Request::create('/sso-confirm-password', 'GET', ['method' => 'google_authenticator', 'status' => 'enable'])
        );

        $pending = session(SsoPasswordConfirmationController::SESSION_KEY);

        $this->assertSame($user->id, $pending['user_id']);
        $this->assertSame('keycloak', $pending['provider']);
        $this->assertSame('google_authenticator', $pending['method']);
        $this->assertSame('enable', $pending['status']);
        $this->assertGreaterThan(time(), $pending['expires_at']);
    }

    public function test_a_matching_provider_identity_confirms_the_password(): void
    {
        $user = $this->ssoUser('kc-123');
        Auth::setUser($user);
        $this->mockProvider($this->socialiteUser('kc-123'));

        session()->put(SsoPasswordConfirmationController::SESSION_KEY, [
            'user_id' => $user->id,
            'provider' => 'keycloak',
            'method' => 'email',
            'status' => 'enable',
            'expires_at' => time() + 60,
        ]);

        app(SsoPasswordConfirmationController::class)->confirm('keycloak');

        $this->assertGreaterThan(0, session('auth.password_confirmed_at'));
        $this->assertSame(
            ['method' => 'email', 'status' => 'enable'],
            session('two_fa_resume')
        );
        $this->assertFalse(session()->has(SsoPasswordConfirmationController::SESSION_KEY));
    }

    public function test_another_accounts_identity_does_not_confirm_the_password(): void
    {
        $user = $this->ssoUser('kc-123');
        Auth::setUser($user);
        $this->mockProvider($this->socialiteUser('kc-999'));

        session()->put(SsoPasswordConfirmationController::SESSION_KEY, [
            'user_id' => $user->id,
            'provider' => 'keycloak',
            'method' => 'email',
            'status' => 'enable',
            'expires_at' => time() + 60,
        ]);

        app(SsoPasswordConfirmationController::class)->confirm('keycloak');

        $this->assertNull(session('auth.password_confirmed_at'));
        $this->assertNull(session('two_fa_resume'));
    }

    public function test_an_expired_confirmation_is_rejected(): void
    {
        $user = $this->ssoUser();
        Auth::setUser($user);
        $this->mockProvider($this->socialiteUser('kc-123'));

        session()->put(SsoPasswordConfirmationController::SESSION_KEY, [
            'user_id' => $user->id,
            'provider' => 'keycloak',
            'method' => 'email',
            'status' => 'enable',
            'expires_at' => time() - 1,
        ]);

        app(SsoPasswordConfirmationController::class)->confirm('keycloak');

        $this->assertNull(session('auth.password_confirmed_at'));
    }

}
