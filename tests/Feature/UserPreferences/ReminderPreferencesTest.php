<?php

namespace Tests\Feature\UserPreferences;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReminderPreferencesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('user_reminder_preferences');
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
            $table->boolean('admin_approval')->default(true);
            $table->timestamps();
        });

        Schema::create('user_reminder_preferences', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('entity_type', 32)->default('meeting');
            $table->text('reminders')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['user_id', 'entity_type']);
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
        Schema::dropIfExists('user_reminder_preferences');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        parent::tearDown();
    }

    private function createUser(string $email = 'reminders@example.com'): User
    {
        $id = DB::table('users')->insertGetId([
            'company_id' => 1,
            'name' => 'Reminder User',
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
            'name' => 'Reminder User',
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
        session([
            'user' => $user,
            'company' => (object) ['id' => 1],
        ]);
    }

    public function test_index_returns_meeting_defaults_when_none_saved(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $this->getJson(route('reminder-preferences.index'))
            ->assertOk()
            ->assertJsonPath('preferences.meeting.is_active', true)
            ->assertJsonPath('preferences.meeting.is_custom', false)
            ->assertJsonPath('defaults.0.time', 1)
            ->assertJsonPath('defaults.0.type', 'hour');
    }

    public function test_update_stores_meeting_reminders_for_authenticated_user(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        $reminders = [
            ['time' => 2, 'type' => 'hour'],
            ['time' => 15, 'type' => 'minute'],
        ];

        $this->postJson(route('reminder-preferences.update'), [
            'entity_type' => 'meeting',
            'reminders' => $reminders,
            'is_active' => true,
        ])->assertOk()->assertJsonPath('status', 'success');

        $row = DB::table('user_reminder_preferences')
            ->where('user_id', $user->id)
            ->where('entity_type', 'meeting')
            ->first();

        $this->assertNotNull($row);
        $this->assertTrue((bool) $row->is_active);

        $saved = is_string($row->reminders) ? json_decode($row->reminders, true) : $row->reminders;
        $this->assertSame(2, $saved[0]['time']);
        $this->assertSame('hour', $saved[0]['type']);
    }

    public function test_reset_deletes_custom_meeting_preference(): void
    {
        $this->withoutMiddleware();

        $user = $this->createUser();
        $this->actingAsSessionUser($user);

        DB::table('user_reminder_preferences')->insert([
            'company_id' => 1,
            'user_id' => $user->id,
            'entity_type' => 'meeting',
            'reminders' => json_encode([['time' => 45, 'type' => 'minute']]),
            'is_active' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson(route('reminder-preferences.reset', ['entityType' => 'meeting']))
            ->assertOk()
            ->assertJsonPath('status', 'success');

        $this->assertFalse(
            DB::table('user_reminder_preferences')
                ->where('user_id', $user->id)
                ->where('entity_type', 'meeting')
                ->exists()
        );
    }
}
