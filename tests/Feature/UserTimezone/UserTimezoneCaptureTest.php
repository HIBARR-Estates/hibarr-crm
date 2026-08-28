<?php

namespace Tests\Feature\UserTimezone;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserTimezoneCaptureTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('client_contacts');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('timezone')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('status')->default('active');
            $table->string('timezone', 64)->nullable();
            $table->boolean('timezone_locked')->default(false);
            $table->boolean('admin_approval')->default(true);
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert([
            'id' => 1,
            'company_name' => 'Test Co',
            'timezone' => 'UTC',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        parent::tearDown();
    }

    private function createUser(?string $timezone = null): User
    {
        $id = DB::table('users')->insertGetId([
            'company_id' => 1,
            'name' => 'Timezone User',
            'email' => 'tz-user@example.com',
            'password' => bcrypt('secret'),
            'status' => 'active',
            'timezone' => $timezone,
            'timezone_locked' => false,
            'admin_approval' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = new User;
        $user->forceFill([
            'id' => $id,
            'company_id' => 1,
            'name' => 'Timezone User',
            'email' => 'tz-user@example.com',
            'status' => 'active',
            'timezone' => $timezone,
            'timezone_locked' => false,
            'admin_approval' => true,
        ]);
        $user->exists = true;
        $user->syncOriginal();

        return $user;
    }

    private function actingAsSessionUser(User $user): void
    {
        $this->actingAs($user);
        session(['user' => $user]);
    }

    private function userTimezone(int $id): ?string
    {
        $value = DB::table('users')->where('id', $id)->value('timezone');

        return is_string($value) || $value === null ? $value : (string) $value;
    }

    private function userUpdatedAt(int $id): ?string
    {
        return DB::table('users')->where('id', $id)->value('updated_at');
    }

    public function test_persists_timezone_when_user_has_none_set(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser(null);
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('profile.update_timezone'), [
            'timezone' => 'Europe/Berlin',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame('Europe/Berlin', $this->userTimezone($user->id));
    }

    public function test_does_not_overwrite_when_timezone_unchanged(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser('Europe/Berlin');
        $this->actingAsSessionUser($user);

        DB::table('users')->where('id', $user->id)->update([
            'updated_at' => '2020-01-01 00:00:00',
        ]);

        $response = $this->postJson(route('profile.update_timezone'), [
            'timezone' => 'Europe/Berlin',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame('Europe/Berlin', $this->userTimezone($user->id));
        $this->assertSame('2020-01-01 00:00:00', $this->userUpdatedAt($user->id));
    }

    public function test_overwrites_when_timezone_differs(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser('Europe/Berlin');
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('profile.update_timezone'), [
            'timezone' => 'America/New_York',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame('America/New_York', $this->userTimezone($user->id));
    }

    public function test_does_not_overwrite_when_timezone_is_locked(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser('Europe/Berlin');
        DB::table('users')->where('id', $user->id)->update(['timezone_locked' => 1]);
        $user->timezone_locked = true;
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('profile.update_timezone'), [
            'timezone' => 'America/New_York',
        ]);

        $response->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertSame('Europe/Berlin', $this->userTimezone($user->id));
    }

    public function test_rejects_non_iana_timezone(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser(null);
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('profile.update_timezone'), [
            'timezone' => 'Not/A_Real_Zone',
        ]);

        $response->assertStatus(422);
        $this->assertNull($this->userTimezone($user->id));
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $response = $this->post(route('profile.update_timezone'), [
            'timezone' => 'Europe/Berlin',
        ]);

        $response->assertRedirect();
    }
}
