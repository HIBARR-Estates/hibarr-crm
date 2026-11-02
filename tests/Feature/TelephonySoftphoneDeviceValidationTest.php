<?php

namespace Tests\Feature;

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
