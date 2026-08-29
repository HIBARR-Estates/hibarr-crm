<?php

namespace Tests\Feature\UserPreferences;

use App\Listeners\SuppressBypassedNotification;
use App\Models\User;
use App\Notifications\BulkActionCompleted;
use App\Notifications\TwoFactorCode;
use App\Support\NotificationBypass;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Notifications\Events\NotificationSending;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class NotificationBypassTest extends TestCase
{
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('user_notification_bypasses');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('client_contacts');

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
            $table->string('timezone', 64)->nullable();
            $table->boolean('timezone_locked')->default(false);
            $table->boolean('admin_approval')->default(true);
            $table->timestamps();
        });

        Schema::create('user_notification_bypasses', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->string('notification_key', 128);
            $table->timestamps();
            $table->unique(['user_id', 'notification_key']);
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
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('user_notification_bypasses');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        parent::tearDown();
    }

    private function createUser(string $email = 'prefs@example.com'): User
    {
        $id = DB::table('users')->insertGetId([
            'company_id' => 1,
            'name' => 'Prefs User',
            'email' => $email,
            'password' => bcrypt('secret'),
            'status' => 'active',
            'admin_approval' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $user = new User;
        $user->forceFill([
            'id' => $id,
            'company_id' => 1,
            'name' => 'Prefs User',
            'email' => $email,
            'status' => 'active',
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

    public function test_flag_off_does_not_suppress_bypassed_type(): void
    {
        $this->setFeatureFlag(NotificationBypass::FLAG, false);

        $user = $this->createUser();
        DB::table('user_notification_bypasses')->insert([
            'user_id' => $user->id,
            'notification_key' => 'BulkActionCompleted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $event = new NotificationSending($user, new BulkActionCompleted('deals', 'update', 1), 'mail');
        $this->assertNull((new SuppressBypassedNotification)->handle($event));
    }

    public function test_flag_on_suppresses_bypassed_type_on_all_channels(): void
    {
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $user = $this->createUser();
        DB::table('user_notification_bypasses')->insert([
            'user_id' => $user->id,
            'notification_key' => 'BulkActionCompleted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $notification = new BulkActionCompleted('deals', 'update', 1);
        $listener = new SuppressBypassedNotification;

        $this->assertFalse($listener->handle(new NotificationSending($user, $notification, 'mail')));
        $this->assertFalse($listener->handle(new NotificationSending($user, $notification, 'database')));
    }

    public function test_bypassing_one_type_does_not_affect_another(): void
    {
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $user = $this->createUser();
        DB::table('user_notification_bypasses')->insert([
            'user_id' => $user->id,
            'notification_key' => 'BulkActionCompleted',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $other = new TwoFactorCode;
        $this->assertNull(
            (new SuppressBypassedNotification)->handle(new NotificationSending($user, $other, 'mail'))
        );
    }

    public function test_denylisted_type_cannot_be_suppressed_even_if_row_exists(): void
    {
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $user = $this->createUser();
        DB::table('user_notification_bypasses')->insert([
            'user_id' => $user->id,
            'notification_key' => 'TwoFactorCode',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertNull(
            (new SuppressBypassedNotification)->handle(
                new NotificationSending($user, new TwoFactorCode, 'mail')
            )
        );
    }

    public function test_put_stores_bypass_for_authenticated_user_only(): void
    {
        $this->withoutMiddleware();
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $userA = $this->createUser('a@example.com');
        $userB = $this->createUser('b@example.com');
        $this->actingAsSessionUser($userA);

        $response = $this->putJson(route('user-preferences.bypasses'), [
            'key' => 'DealActivityNotification',
            'bypassed' => true,
        ]);

        $response->assertOk()->assertJsonPath('status', 'success');

        $this->assertTrue(
            DB::table('user_notification_bypasses')
                ->where('user_id', $userA->id)
                ->where('notification_key', 'DealActivityNotification')
                ->exists()
        );
        $this->assertFalse(
            DB::table('user_notification_bypasses')
                ->where('user_id', $userB->id)
                ->exists()
        );
    }

    public function test_put_rejects_unknown_and_denylisted_keys(): void
    {
        $this->withoutMiddleware();
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $this->putJson(route('user-preferences.bypasses'), [
            'key' => 'NotARealNotification',
            'bypassed' => true,
        ])->assertStatus(422);

        $this->putJson(route('user-preferences.bypasses'), [
            'key' => 'TwoFactorCode',
            'bypassed' => true,
        ])->assertStatus(422);

        $this->assertSame(0, DB::table('user_notification_bypasses')->count());
    }

    public function test_put_bulk_keys_inserts_and_deletes_for_authenticated_user_only(): void
    {
        $this->withoutMiddleware();
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $userA = $this->createUser('a@example.com');
        $userB = $this->createUser('b@example.com');
        $this->actingAsSessionUser($userA);

        $keys = ['DealActivityNotification', 'DealStageUpdated', 'NewTask'];

        $this->putJson(route('user-preferences.bypasses'), [
            'keys' => $keys,
            'bypassed' => true,
        ])->assertOk()
            ->assertJsonPath('bypassed', true)
            ->assertJsonPath('keys', $keys);

        $this->assertSame(3, DB::table('user_notification_bypasses')->where('user_id', $userA->id)->count());
        $this->assertFalse(
            DB::table('user_notification_bypasses')->where('user_id', $userB->id)->exists()
        );

        $this->putJson(route('user-preferences.bypasses'), [
            'keys' => ['DealActivityNotification', 'NewTask'],
            'bypassed' => false,
        ])->assertOk();

        $remaining = DB::table('user_notification_bypasses')
            ->where('user_id', $userA->id)
            ->pluck('notification_key')
            ->all();

        $this->assertEqualsCanonicalizing(['DealStageUpdated'], $remaining);
    }

    public function test_put_bulk_rejects_unknown_or_denylisted_key_and_writes_nothing(): void
    {
        $this->withoutMiddleware();
        $this->setFeatureFlag(NotificationBypass::FLAG, true);

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $this->putJson(route('user-preferences.bypasses'), [
            'keys' => ['DealActivityNotification', 'TwoFactorCode'],
            'bypassed' => true,
        ])->assertStatus(422);

        $this->putJson(route('user-preferences.bypasses'), [
            'keys' => ['DealActivityNotification', 'NotARealNotification'],
            'bypassed' => true,
        ])->assertStatus(422);

        $this->assertSame(0, DB::table('user_notification_bypasses')->count());
    }

    public function test_put_is_forbidden_when_flag_is_off(): void
    {
        $this->withoutMiddleware();
        $this->setFeatureFlag(NotificationBypass::FLAG, false);

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $this->putJson(route('user-preferences.bypasses'), [
            'key' => 'DealActivityNotification',
            'bypassed' => true,
        ])->assertStatus(403);
    }

    public function test_timezone_picker_locks_override(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('user-preferences.timezone'), [
            'timezone' => 'Europe/Berlin',
            'locked' => true,
        ]);

        $response->assertOk()
            ->assertJsonPath('timezone', 'Europe/Berlin')
            ->assertJsonPath('timezoneLocked', true);

        $row = DB::table('users')->where('id', $user->id)->first();
        $this->assertSame('Europe/Berlin', $row->timezone);
        $this->assertTrue((bool) $row->timezone_locked);
    }

    public function test_use_browser_clears_lock(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser();
        DB::table('users')->where('id', $user->id)->update([
            'timezone' => 'Europe/Berlin',
            'timezone_locked' => 1,
        ]);
        $user->timezone = 'Europe/Berlin';
        $user->timezone_locked = true;
        $this->actingAsSessionUser($user);

        $response = $this->postJson(route('user-preferences.timezone'), [
            'timezone' => 'America/New_York',
            'locked' => false,
        ]);

        $response->assertOk()->assertJsonPath('timezoneLocked', false);

        $row = DB::table('users')->where('id', $user->id)->first();
        $this->assertSame('America/New_York', $row->timezone);
        $this->assertFalse((bool) $row->timezone_locked);
    }
}
