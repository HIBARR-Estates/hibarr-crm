<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\LoginController;
use App\Models\SocialAuthSetting;
use App\Support\SilentSso;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SilentSsoTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');
        $this->setFeatureFlag(SilentSso::FLAG, true);

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('social_auth_settings');
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

    private function session(array $data = []): Store
    {
        $session = new Store('test', new ArraySessionHandler(120));
        $session->start();
        $session->put($data);

        return $session;
    }

    private function request(string $method = 'GET', string $uri = '/dashboard', array $params = [], ?Store $session = null): Request
    {
        $request = Request::create($uri, $method, $params);
        $request->setLaravelSession($session ?? $this->session());

        return $request;
    }

    public function test_it_is_off_by_default(): void
    {
        $this->setFeatureFlag(SilentSso::FLAG, false);

        $this->assertFalse(SilentSso::enabled());
        $this->assertFalse(SilentSso::shouldAttempt($this->request()));
    }

    public function test_a_guest_page_request_is_sent_through_the_silent_sign_in(): void
    {
        $this->assertTrue(SilentSso::shouldAttempt($this->request()));
    }

    public function test_ajax_json_and_non_get_requests_are_left_alone(): void
    {
        $this->assertFalse(SilentSso::shouldAttempt($this->request('POST')));

        $json = $this->request();
        $json->headers->set('Accept', 'application/json');
        $this->assertFalse(SilentSso::shouldAttempt($json));

        $ajax = $this->request();
        $ajax->headers->set('X-Requested-With', 'XMLHttpRequest');
        $this->assertFalse(SilentSso::shouldAttempt($ajax));
    }

    public function test_the_loop_guard_blocks_a_second_attempt_inside_the_window(): void
    {
        $session = $this->session();

        $this->assertTrue(SilentSso::canAttempt($session, 1_000));
        SilentSso::markAttempt($session, 1_000);

        $this->assertFalse(SilentSso::canAttempt($session, 1_000 + SilentSso::WINDOW_SECONDS - 1));
        $this->assertTrue(SilentSso::canAttempt($session, 1_000 + SilentSso::WINDOW_SECONDS));
    }

    public function test_declined_outcomes_are_login_required_interaction_required_and_consent_required(): void
    {
        foreach (['login_required', 'interaction_required', 'consent_required'] as $error) {
            $this->assertTrue(SilentSso::isDeclined($error), $error);
        }

        $this->assertFalse(SilentSso::isDeclined('access_denied'));
        $this->assertFalse(SilentSso::isDeclined(null));
    }

    public function test_the_redirect_action_asks_keycloak_with_prompt_none_and_sets_the_guard(): void
    {
        $driver = Mockery::mock();
        $driver->shouldReceive('with')->once()->with(['prompt' => 'none'])->andReturnSelf();
        $driver->shouldReceive('redirect')->once()->andReturn(redirect('https://auth.example.test/auth'));
        Socialite::shouldReceive('driver')->with('keycloak')->andReturn($driver);

        $session = $this->session();
        $response = app(LoginController::class)->redirect($this->request('GET', '/redirect/keycloak', ['silent' => 1], $session), 'keycloak');

        $this->assertSame('https://auth.example.test/auth', $response->getTargetUrl());
        $this->assertFalse(SilentSso::canAttempt($session));
    }

    public function test_the_interactive_redirect_does_not_use_prompt_none(): void
    {
        $driver = Mockery::mock();
        $driver->shouldNotReceive('with');
        $driver->shouldReceive('redirect')->once()->andReturn(redirect('https://auth.example.test/auth'));
        Socialite::shouldReceive('driver')->with('keycloak')->andReturn($driver);

        app(LoginController::class)->redirect($this->request('GET', '/redirect/keycloak'), 'keycloak');

        $this->addToAssertionCount(1);
    }

    public function test_a_second_silent_attempt_inside_the_window_goes_to_the_login_page_instead_of_looping(): void
    {
        Socialite::shouldReceive('driver')->never();

        $session = $this->session();
        SilentSso::markAttempt($session);

        $response = app(LoginController::class)->redirect($this->request('GET', '/redirect/keycloak', ['silent' => 1], $session), 'keycloak');

        $this->assertStringEndsWith('/login', $response->getTargetUrl());
    }

    public function test_a_declined_silent_sign_in_shows_the_login_page_without_an_error(): void
    {
        Socialite::shouldReceive('driver')->never();

        $response = app(LoginController::class)->callback(
            $this->request('GET', '/callback/keycloak', ['error' => 'login_required', 'state' => 'abc']),
            'keycloak',
        );

        $this->assertStringEndsWith('/login', $response->getTargetUrl());
        $this->assertNull($response->getSession()?->get('message'));
    }
}
