<?php

namespace Tests\Feature;

use App\Models\SoftphoneDevice;
use App\Models\User;
use App\Support\SipProviderRegistry;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * The credentials endpoint must never expose the SIP password or reusable HA1
 * hash to the browser; browsers authenticate SIP 401/407 Digest challenges via
 * the server-side `signChallenge` endpoint instead.
 */
class TelephonySoftphoneCredentialsTest extends TestCase
{
    use SetsFeatureFlags;

    private const COMPANY_ID = 1;

    private const USER_ID = 99;

    private const PASSWORD = 'super-secret-pw';

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createMinimalSchema();

        $this->setFeatureFlag('crm.softphone', true);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Schema::dropIfExists('softphone_call_agents');
        Schema::dropIfExists('softphone_devices');

        parent::tearDown();
    }

    public function test_credentials_never_returns_password_or_ha1_for_sipgate_line(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate');

        $data = $this->getJson(route('telephony.softphone.devices.credentials', $device->id))
            ->assertOk()
            ->json('data');

        $this->assertSame('challenge', $data['auth_mode']);
        $this->assertSame($device->id, $data['id']);
        $this->assertArrayNotHasKey('authorization_password', $data);
        $this->assertArrayNotHasKey('authorization_ha1', $data);
    }

    public function test_credentials_never_returns_password_or_ha1_for_custom_line(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice(null);

        $data = $this->getJson(route('telephony.softphone.devices.credentials', $device->id))
            ->assertOk()
            ->json('data');

        $this->assertSame('challenge', $data['auth_mode']);
        $this->assertArrayNotHasKey('authorization_password', $data);
        $this->assertArrayNotHasKey('authorization_ha1', $data);
    }

    public function test_a_disabled_line_returns_423_for_credentials_and_sign_challenge(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate', false);

        $this->getJson(route('telephony.softphone.devices.credentials', $device->id))
            ->assertStatus(423);

        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), [
            'method' => 'REGISTER',
            'uri' => 'sip:sipgate.de',
            'realm' => 'sipgate.de',
            'nonce' => 'nonce-123',
            'qop' => 'auth',
            'nc' => '00000001',
            'cnonce' => 'abcdef123456',
        ])->assertStatus(423);
    }

    public function test_sign_challenge_computes_exact_rfc2617_auth_response_without_exposing_secrets(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate');

        $nonce = 'server-nonce-xyz';
        $nc = '00000001';
        $cnonce = 'a1b2c3d4e5f6';
        $method = 'REGISTER';
        $uri = 'sip:sipgate.de';
        $realm = 'sipgate.de';

        $expectedHa1 = md5('4711:'.$realm.':'.self::PASSWORD);
        $expectedHa2 = md5($method.':'.$uri);
        $expectedResponse = md5($expectedHa1.':'.$nonce.':'.$nc.':'.$cnonce.':auth:'.$expectedHa2);

        $res = $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), [
            'method' => $method,
            'uri' => $uri,
            'realm' => $realm,
            'nonce' => $nonce,
            'qop' => 'auth',
            'nc' => $nc,
            'cnonce' => $cnonce,
            'algorithm' => 'MD5',
        ])->assertOk();

        $rawBody = $res->getContent();
        $this->assertStringNotContainsString(self::PASSWORD, $rawBody);
        $this->assertStringNotContainsString($expectedHa1, $rawBody);

        $data = $res->json('data');
        $this->assertSame('4711', $data['username']);
        $this->assertSame($expectedResponse, $data['response']);
        $this->assertSame('auth', $data['qop']);
        $this->assertSame($nc, $data['nc']);
        $this->assertSame($cnonce, $data['cnonce']);
    }

    public function test_sign_challenge_supports_legacy_digest_without_qop(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate');

        $nonce = 'legacy-nonce-99';
        $method = 'INVITE';
        $uri = 'sip:+491701234567@sipgate.de';
        $realm = 'sipgate.de';

        $expectedHa1 = md5('4711:'.$realm.':'.self::PASSWORD);
        $expectedHa2 = md5($method.':'.$uri);
        $expectedResponse = md5($expectedHa1.':'.$nonce.':'.$expectedHa2);

        $data = $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), [
            'method' => $method,
            'uri' => $uri,
            'realm' => $realm,
            'nonce' => $nonce,
        ])->assertOk()->json('data');

        $this->assertSame($expectedResponse, $data['response']);
        $this->assertNull($data['qop']);
        $this->assertNull($data['nc']);
        $this->assertNull($data['cnonce']);
    }

    public function test_sign_challenge_rejects_unexpected_realm_for_known_provider(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate');

        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), [
            'method' => 'REGISTER',
            'uri' => 'sip:evil.example.com',
            'realm' => 'evil.example.com',
            'nonce' => 'nonce-evil',
            'qop' => 'auth',
            'nc' => '00000001',
            'cnonce' => 'abcdef123456',
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['realm']);
    }

    public function test_sign_challenge_pins_custom_lines_to_their_own_uri_domain_or_wss_host(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        // No provider, so no registry realm: the line's own domains are the pin.
        $device = $this->makeDevice(null);

        $payload = fn (string $realm) => [
            'method' => 'REGISTER',
            'uri' => 'sip:'.$realm,
            'realm' => $realm,
            'nonce' => 'nonce-custom',
            'qop' => 'auth',
            'nc' => '00000001',
            'cnonce' => 'abcdef123456',
        ];

        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload('evil.example.com'))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['realm']);

        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload('SIPGATE.DE'))
            ->assertOk();

        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload('sip.sipgate.de'))
            ->assertOk();
    }

    public function test_sign_challenge_blocks_deactivated_or_unauthorized_users(): void
    {
        $this->withoutMiddleware();
        $device = $this->makeDevice('sipgate');

        $payload = [
            'method' => 'REGISTER',
            'uri' => 'sip:sipgate.de',
            'realm' => 'sipgate.de',
            'nonce' => 'nonce-123',
            'qop' => 'auth',
            'nc' => '00000001',
            'cnonce' => 'abcdef123456',
        ];

        // Deactivated user is immediately refused even if admin.
        $this->actingAsUser(isAdmin: true, status: 'deactive');
        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload)
            ->assertStatus(403);

        // User with disabled login is immediately refused.
        $this->actingAsUser(isAdmin: true, login: 'disable');
        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload)
            ->assertStatus(403);

        // Active non-admin without make_softphone_calls is refused.
        $this->actingAsUser(isAdmin: false, softphonePerm: 'none');
        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), $payload)
            ->assertStatus(403);
    }

    public function test_hand_out_and_challenge_signing_are_logged_without_secrets(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();
        $device = $this->makeDevice('sipgate');
        $ha1 = SipProviderRegistry::ha1('sipgate', '4711', self::PASSWORD);

        Log::spy();

        $this->getJson(route('telephony.softphone.devices.credentials', $device->id))->assertOk();
        $this->postJson(route('telephony.softphone.devices.sign-challenge', $device->id), [
            'method' => 'REGISTER',
            'uri' => 'sip:sipgate.de',
            'realm' => 'sipgate.de',
            'nonce' => 'audit-nonce',
            'qop' => 'auth',
            'nc' => '00000001',
            'cnonce' => 'abcdef123456',
        ])->assertOk();

        Log::shouldHaveReceived('info')
            ->withArgs(function (string $message, array $context = []) use ($device, $ha1): bool {
                if ($message !== 'softphone.credentials_issued') {
                    return false;
                }

                $encoded = (string) json_encode($context);

                return $context['device_id'] === $device->id
                    && $context['user_id'] === self::USER_ID
                    && $context['company_id'] === self::COMPANY_ID
                    && $context['mode'] === 'challenge'
                    && array_key_exists('ip', $context)
                    && ! str_contains($encoded, self::PASSWORD)
                    && ! str_contains($encoded, (string) $ha1);
            })
            ->once();

        Log::shouldHaveReceived('info')
            ->withArgs(function (string $message, array $context = []) use ($device, $ha1): bool {
                if ($message !== 'softphone.challenge_signed') {
                    return false;
                }

                $encoded = (string) json_encode($context);

                return $context['device_id'] === $device->id
                    && $context['user_id'] === self::USER_ID
                    && $context['method'] === 'REGISTER'
                    && $context['realm'] === 'sipgate.de'
                    && ! str_contains($encoded, self::PASSWORD)
                    && ! str_contains($encoded, (string) $ha1)
                    && ! str_contains($encoded, 'audit-nonce');
            })
            ->once();
    }

    // Helpers

    private function makeDevice(?string $provider, bool $active = true): SoftphoneDevice
    {
        $device = new SoftphoneDevice;
        $device->company_id = self::COMPANY_ID;
        $device->label = 'German';
        $device->provider = $provider;
        $device->wss_url = 'wss://sip.sipgate.de';
        $device->uri = 'sip:4711@sipgate.de';
        $device->authorization_username = '4711';
        $device->authorization_password = self::PASSWORD;
        $device->is_active = $active;
        $device->save();

        return $device;
    }

    private function actingAsAdmin(): void
    {
        $this->actingAsUser(isAdmin: true);
    }

    private function actingAsUser(
        bool $isAdmin = false,
        string $softphonePerm = 'all',
        string $status = 'active',
        string $login = 'enable',
    ): void {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = self::USER_ID;
        $user->company_id = self::COMPANY_ID;
        $user->status = $status;
        $user->login = $login;
        $user->shouldReceive('hasRole')->andReturn($isAdmin);
        $user->shouldReceive('permission')->andReturn($softphonePerm);

        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => self::COMPANY_ID]]);
    }

    private function createMinimalSchema(): void
    {
        Schema::dropIfExists('softphone_call_agents');
        Schema::dropIfExists('softphone_devices');

        Schema::create('softphone_devices', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label');
            $table->string('provider')->nullable();
            $table->string('wss_url');
            $table->string('uri');
            $table->string('authorization_username')->nullable();
            $table->text('authorization_password'); // encrypted at rest
            $table->string('display_name')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('max_concurrent_calls')->default(2);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('softphone_call_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('device_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('tier')->default('line');
            $table->boolean('active')->default(true);
            $table->unsignedInteger('priority')->default(1);
            $table->timestamps();
        });
    }
}
