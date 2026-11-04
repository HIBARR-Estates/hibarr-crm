<?php

namespace Tests\Feature;

use App\Models\SoftphoneDevice;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * A line's platform decides the WebSocket endpoint and SIP URI it registers
 * with, so a create without one would store a line the softphone cannot use.
 *
 * Covers the validation rules behind the settings form:
 *  - the provider is required on create;
 *  - only platforms the CRM can resolve defaults for are accepted;
 *  - a platform that builds the SIP URI from the username needs one.
 */
class TelephonySoftphoneDeviceValidationTest extends TestCase
{
    use SetsFeatureFlags;

    private const COMPANY_ID = 1;

    private const USER_ID = 99;

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
        Schema::dropIfExists('softphone_devices');

        parent::tearDown();
    }

    public function test_creating_a_line_without_a_provider_is_refused(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'authorization_username' => '4711',
            'authorization_password' => 'secret',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('provider');
    }

    public function test_creating_a_line_with_an_unknown_provider_is_refused(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'provider' => 'twilio',
            'authorization_username' => '4711',
            'authorization_password' => 'secret',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('provider')
            ->assertJsonPath(
                'errors.provider.0',
                'This CRM does not support the "twilio" provider yet.'
            );
    }

    public function test_a_line_created_with_a_provider_takes_the_platform_connection(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'provider' => 'sipgate',
            'authorization_username' => '4711',
            'authorization_password' => 'secret',
        ])->assertOk();

        $device = DB::table('softphone_devices')->first();

        $this->assertSame('sipgate', $device->provider);
        $this->assertSame('wss://sip.sipgate.de', $device->wss_url);
        $this->assertSame('sip:4711@sipgate.de', $device->uri);
    }

    public function test_a_line_whose_platform_builds_the_uri_from_a_username_requires_one(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'provider' => 'sipgate',
            'authorization_password' => 'secret',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('authorization_username');

        $this->assertSame(0, DB::table('softphone_devices')->count());
    }

    public function test_the_device_list_carries_the_locally_supported_providers(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->getJson(route('telephony.softphone.devices.index'))
            ->assertOk()
            ->assertJsonPath('data.providers', ['sipgate']);
    }

    public function test_updating_only_the_label_keeps_the_stored_connection(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'provider' => 'sipgate',
            'wss_url' => 'wss://custom.example/de',
            'uri' => 'sip:4711@custom.example',
            'authorization_username' => '4711',
            'authorization_password' => 'secret',
        ])->assertOk();

        $id = (int) DB::table('softphone_devices')->value('id');

        // A label-only edit sends neither wss_url nor uri; the stored values
        // must survive untouched.
        $this->putJson(route('telephony.softphone.devices.update', $id), [
            'label' => 'German 2',
        ])->assertOk();

        $device = DB::table('softphone_devices')->find($id);

        $this->assertSame('German 2', $device->label);
        $this->assertSame('sipgate', $device->provider);
        $this->assertSame('wss://custom.example/de', $device->wss_url);
        $this->assertSame('sip:4711@custom.example', $device->uri);
    }

    public function test_changing_the_username_rebuilds_the_sip_uri_and_keeps_the_endpoint(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        $this->postJson(route('telephony.softphone.devices.store'), [
            'label' => 'German',
            'provider' => 'sipgate',
            'wss_url' => 'wss://custom.example/de',
            'authorization_username' => '4711',
            'authorization_password' => 'secret',
        ])->assertOk();

        $id = (int) DB::table('softphone_devices')->value('id');

        // The form no longer builds the URI; the server must notice the new
        // username on its own.
        $this->putJson(route('telephony.softphone.devices.update', $id), [
            'label' => 'German',
            'provider' => 'sipgate',
            'authorization_username' => '4712',
        ])->assertOk();

        $device = DB::table('softphone_devices')->find($id);

        $this->assertSame('sip:4712@sipgate.de', $device->uri);
        // Only the platform decides the endpoint; a username change is not a
        // reason to replace a custom one.
        $this->assertSame('wss://custom.example/de', $device->wss_url);
    }

    public function test_switching_the_provider_re_resolves_the_connection(): void
    {
        $this->withoutMiddleware();
        $this->actingAsAdmin();

        // A line stored before providers existed (provider = null).
        $legacy = new SoftphoneDevice();
        $legacy->company_id = self::COMPANY_ID;
        $legacy->label = 'Legacy';
        $legacy->wss_url = 'wss://legacy.example';
        $legacy->uri = 'sip:old@legacy.example';
        $legacy->authorization_username = 'old';
        $legacy->authorization_password = 'secret';
        $legacy->save();

        $this->putJson(route('telephony.softphone.devices.update', $legacy->id), [
            'label' => 'Legacy',
            'provider' => 'sipgate',
            'authorization_username' => '4711',
        ])->assertOk();

        $device = DB::table('softphone_devices')->find($legacy->id);

        $this->assertSame('sipgate', $device->provider);
        $this->assertSame('wss://sip.sipgate.de', $device->wss_url);
        $this->assertSame('sip:4711@sipgate.de', $device->uri);
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private function actingAsAdmin(): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = self::USER_ID;
        $user->company_id = self::COMPANY_ID;
        $user->shouldReceive('hasRole')->andReturn(true);

        $this->actingAs($user);
        session(['user' => $user, 'company' => (object) ['id' => self::COMPANY_ID]]);
    }

    private function createMinimalSchema(): void
    {
        Schema::dropIfExists('softphone_devices');

        Schema::create('softphone_devices', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label');
            // SIP platform the line belongs to (e.g. sipgate).
            $table->string('provider')->nullable();
            $table->string('wss_url');
            $table->string('uri');
            $table->string('authorization_username')->nullable();
            $table->text('authorization_password'); // encrypted at rest
            $table->string('display_name')->nullable();
            $table->boolean('is_default')->default(false);
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });
    }
}
