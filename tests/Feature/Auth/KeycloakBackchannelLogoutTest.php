<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\KeycloakBackchannelLogoutController;
use App\Http\Middleware\EnsureKeycloakSessionActive;
use App\Http\Middleware\VerifyCsrfToken;
use App\Models\Social;
use App\Models\SocialAuthSetting;
use App\Models\User;
use App\Support\KeycloakBackchannelLogout;
use Firebase\JWT\JWT;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class KeycloakBackchannelLogoutTest extends TestCase
{
    private const ISSUER = 'https://auth.example.test/realms/hibarr';
    private const CLIENT_ID = 'crm';
    private const KID = 'test-key';

    /** @var \OpenSSLAsymmetricKey */
    private $privateKey;

    /** Key the faked Keycloak currently publishes in its JWKS. */
    private $publishedKey;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');
        Config::set('services.keycloak.base_url', 'https://auth.example.test');
        Config::set('services.keycloak.realms', 'hibarr');
        Config::set('services.keycloak.client_id', self::CLIENT_ID);
        Config::set('services.keycloak.client_secret', 'secret');

        DB::purge('sqlite');
        DB::reconnect('sqlite');
        Cache::flush();

        Schema::dropIfExists('socials');
        Schema::dropIfExists('social_auth_settings');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('remember_token', 100)->nullable();
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

        $this->privateKey = $this->newKey();
        $this->publishedKey = $this->privateKey;

        // Registered once: a second Http::fake() would not replace this stub.
        Http::fake([
            'auth.example.test/*' => fn () => Http::response($this->jwksFor($this->publishedKey)),
        ]);
    }

    /** @return \OpenSSLAsymmetricKey */
    private function newKey()
    {
        return openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_RSA, 'private_key_bits' => 2048]);
    }

    private function b64url(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private function jwksFor($key): array
    {
        $details = openssl_pkey_get_details($key);

        return ['keys' => [[
            'kty' => 'RSA',
            'use' => 'sig',
            'alg' => 'RS256',
            'kid' => self::KID,
            'n' => $this->b64url($details['rsa']['n']),
            'e' => $this->b64url($details['rsa']['e']),
        ]]];
    }

    private function logoutToken(array $overrides = [], $signWith = null): string
    {
        openssl_pkey_export($signWith ?? $this->privateKey, $pem);

        $claims = array_merge([
            'iss' => self::ISSUER,
            'aud' => self::CLIENT_ID,
            'iat' => time(),
            'jti' => bin2hex(random_bytes(8)),
            'sub' => 'kc-user-1',
            'sid' => 'sid-1',
            'events' => [KeycloakBackchannelLogout::EVENT => new \stdClass],
        ], $overrides);

        $claims = array_filter($claims, fn ($value) => $value !== null);

        return JWT::encode($claims, $pem, 'RS256', self::KID);
    }

    private function sendLogout(?string $token)
    {
        $request = Request::create('/sso/backchannel-logout', 'POST', $token === null ? [] : ['logout_token' => $token]);

        return app(KeycloakBackchannelLogoutController::class)($request);
    }

    private function session(array $data = []): Store
    {
        $session = new Store('test', new ArraySessionHandler(120));
        $session->start();
        $session->put($data);

        return $session;
    }

    public function test_a_valid_logout_token_revokes_the_session_and_answers_200(): void
    {
        $response = $this->sendLogout($this->logoutToken());

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('no-store', $response->headers->get('Cache-Control'));

        $this->assertTrue(KeycloakBackchannelLogout::sessionRevoked($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'sid-1',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time(),
        ])));

        // another session of the same user stays valid
        $this->assertFalse(KeycloakBackchannelLogout::sessionRevoked($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'sid-2',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time(),
        ])));
    }

    public function test_a_token_naming_only_the_user_revokes_every_session_up_to_now(): void
    {
        $response = $this->sendLogout($this->logoutToken(['sid' => null]));

        $this->assertSame(200, $response->getStatusCode());

        $this->assertTrue(KeycloakBackchannelLogout::sessionRevoked($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'any-sid',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time() - 60,
        ])));

        // a login after the logout is unaffected
        $this->assertFalse(KeycloakBackchannelLogout::sessionRevoked($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'any-sid',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time() + 5,
        ])));
    }

    #[DataProvider('invalidTokens')]
    public function test_invalid_logout_tokens_are_rejected_with_400_and_revoke_nothing(callable $makeToken): void
    {
        $response = $this->sendLogout($makeToken($this));

        $this->assertSame(400, $response->getStatusCode());
        $this->assertFalse(KeycloakBackchannelLogout::sessionRevoked($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'sid-1',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time(),
        ])));
    }

    public static function invalidTokens(): array
    {
        return [
            'forged: signed with another key' => [fn (self $t) => $t->logoutToken([], $t->newKey())],
            'wrong issuer' => [fn (self $t) => $t->logoutToken(['iss' => 'https://evil.example/realms/hibarr'])],
            'addressed to another client' => [fn (self $t) => $t->logoutToken(['aud' => 'other-client'])],
            'no back-channel logout event' => [fn (self $t) => $t->logoutToken(['events' => new \stdClass])],
            'contains a nonce (usable as an ID token)' => [fn (self $t) => $t->logoutToken(['nonce' => 'abc'])],
            'names neither session nor user' => [fn (self $t) => $t->logoutToken(['sid' => null, 'sub' => null])],
            'no jti' => [fn (self $t) => $t->logoutToken(['jti' => null])],
            'stale iat' => [fn (self $t) => $t->logoutToken(['iat' => time() - 3600])],
            'not a JWT' => [fn (self $t) => 'garbage'],
        ];
    }

    public function test_a_missing_logout_token_is_a_400(): void
    {
        $this->assertSame(400, $this->sendLogout(null)->getStatusCode());
    }

    public function test_a_replayed_logout_token_is_rejected(): void
    {
        $token = $this->logoutToken(['jti' => 'same-jti']);

        $this->assertSame(200, $this->sendLogout($token)->getStatusCode());
        $this->assertSame(400, $this->sendLogout($token)->getStatusCode());
    }

    public function test_it_retries_with_fresh_keys_after_a_key_rotation(): void
    {
        $oldKey = $this->newKey();

        // Warm the JWKS cache while Keycloak still publishes the old key.
        $this->publishedKey = $oldKey;
        $this->assertSame(200, $this->sendLogout($this->logoutToken([], $oldKey))->getStatusCode());

        // Keycloak rotates: it now signs with, and publishes, the new key.
        $this->publishedKey = $this->privateKey;

        $this->assertSame(200, $this->sendLogout($this->logoutToken(['jti' => 'after-rotation']))->getStatusCode());
    }

    public function test_the_remember_me_token_is_rotated_so_the_user_is_not_silently_signed_back_in(): void
    {
        $user = new User();
        $user->forceFill([
            'company_id' => 1,
            'name' => 'SSO User',
            'email' => 'sso@example.test',
            'password' => bcrypt('nobody-knows'),
            'remember_token' => 'old-remember-token',
        ])->save();
        Social::create(['user_id' => $user->id, 'social_id' => 'kc-user-1', 'social_service' => 'keycloak']);

        $this->assertSame(200, $this->sendLogout($this->logoutToken())->getStatusCode());

        $remember = User::withoutGlobalScopes()->find($user->id)->remember_token;
        $this->assertNotSame('old-remember-token', $remember);
        $this->assertSame(60, strlen($remember));
    }

    public function test_remember_login_stores_the_keycloak_session_identifiers_from_the_id_token(): void
    {
        $idToken = $this->unsignedJwt(['sid' => 'sid-9', 'sub' => 'kc-user-9']);
        $session = $this->session([KeycloakBackchannelLogout::SESSION_SID_KEY => 'stale-sid']);

        KeycloakBackchannelLogout::rememberLogin($session, $idToken);

        $this->assertSame('sid-9', $session->get(KeycloakBackchannelLogout::SESSION_SID_KEY));
        $this->assertSame('kc-user-9', $session->get(KeycloakBackchannelLogout::SESSION_SUB_KEY));
        $this->assertEqualsWithDelta(time(), $session->get(KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY), 2);
    }

    public function test_remember_login_forgets_a_previous_logins_identifiers_when_there_is_no_id_token(): void
    {
        $session = $this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'stale-sid',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'stale-sub',
        ]);

        KeycloakBackchannelLogout::rememberLogin($session, null);

        $this->assertNull($session->get(KeycloakBackchannelLogout::SESSION_SID_KEY));
        $this->assertNull($session->get(KeycloakBackchannelLogout::SESSION_SUB_KEY));
    }

    public function test_sessions_without_keycloak_identifiers_are_left_alone(): void
    {
        $this->sendLogout($this->logoutToken());

        $this->assertFalse(KeycloakBackchannelLogout::sessionRevoked($this->session()));
    }

    public function test_the_middleware_signs_out_a_user_whose_keycloak_session_ended(): void
    {
        $user = new User();
        $user->forceFill(['company_id' => 1, 'name' => 'U', 'email' => 'u@example.test', 'password' => 'x'])->save();

        $request = Request::create('/dashboard', 'GET');
        $request->setLaravelSession($this->session([
            KeycloakBackchannelLogout::SESSION_SID_KEY => 'sid-1',
            KeycloakBackchannelLogout::SESSION_SUB_KEY => 'kc-user-1',
            KeycloakBackchannelLogout::SESSION_AUTHENTICATED_AT_KEY => time(),
        ]));

        $next = fn () => response('ok');

        // Still active: the request goes through.
        Auth::setUser($user);
        $this->assertSame('ok', (new EnsureKeycloakSessionActive)->handle($request, $next)->getContent());

        // Keycloak reports the session ended.
        $this->sendLogout($this->logoutToken());
        $response = (new EnsureKeycloakSessionActive)->handle($request, $next);

        $this->assertTrue($response->isRedirect());
        $this->assertStringEndsWith('/login', $response->headers->get('Location'));
        $this->assertTrue(Auth::guest());
    }

    public function test_the_route_is_exempt_from_csrf_checks(): void
    {
        $middleware = new class(app(), app('encrypter')) extends VerifyCsrfToken {
            public function exempt(): array
            {
                return $this->except;
            }
        };

        $this->assertContains('sso/backchannel-logout', $middleware->exempt());
        $this->assertSame('/sso/backchannel-logout', route('sso.backchannel_logout', [], false));
    }

    private function unsignedJwt(array $claims): string
    {
        return $this->b64url('{"alg":"none"}').'.'.$this->b64url(json_encode($claims)).'.sig';
    }
}
