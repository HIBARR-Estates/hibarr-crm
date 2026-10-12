<?php

namespace Tests\Feature\Partners;

use App\Notifications\PartnerFlagRaised;
use App\Support\PartnerFlagRecipients;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Behind crm.partner-flag-routing, a partner flag reaches everyone who can
 * answer it, not just admins; with the flag off it is admins only, as before.
 */
class PartnerFlagRoutingTest extends TestCase
{
    private const TABLES = ['user_permissions', 'permissions', 'role_user', 'roles', 'client_contacts', 'sessions', 'users', 'companies'];

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('companies', function (Blueprint $t) {
            $t->increments('id');
            $t->string('company_name')->nullable();
        });
        Schema::create('users', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->string('name');
            $t->string('email')->nullable();
            $t->string('status')->default('active');
        });
        // User eager-loads these by default; left empty.
        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->unsignedInteger('user_id')->nullable();
        });
        Schema::create('client_contacts', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->unsignedInteger('user_id')->nullable();
        });
        Schema::create('roles', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
            $t->unsignedInteger('company_id')->nullable();
        });
        Schema::create('role_user', function (Blueprint $t) {
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('role_id');
        });
        Schema::create('permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
        });
        Schema::create('user_permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('permission_type_id');
        });

        DB::table('companies')->insert([['id' => 1, 'company_name' => 'One'], ['id' => 2, 'company_name' => 'Two']]);
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'admin', 'company_id' => 1],
            ['id' => 2, 'name' => 'employee', 'company_id' => 1],
            ['id' => 3, 'name' => 'partner', 'company_id' => 1],
            ['id' => 4, 'name' => 'sales-manager', 'company_id' => 1],
        ]);
        DB::table('permissions')->insert(['id' => 1, 'name' => 'manage_partner_flags']);

        // 10 admin · 11 manager (holds it) · 12 admin who also holds it
        // 13 inactive holder · 14 other-company holder · 15 holds it as "none"
        // 16 partner-only who somehow holds it
        foreach ([10, 11, 12, 13, 15, 16] as $id) {
            DB::table('users')->insert(['id' => $id, 'company_id' => 1, 'name' => "User $id", 'status' => $id === 13 ? 'deactive' : 'active']);
        }
        DB::table('users')->insert(['id' => 14, 'company_id' => 2, 'name' => 'User 14', 'status' => 'active']);

        DB::table('role_user')->insert([
            ['user_id' => 10, 'role_id' => 1], ['user_id' => 12, 'role_id' => 1],
            ['user_id' => 11, 'role_id' => 4], ['user_id' => 13, 'role_id' => 4],
            ['user_id' => 14, 'role_id' => 4], ['user_id' => 15, 'role_id' => 4],
            ['user_id' => 16, 'role_id' => 2], ['user_id' => 16, 'role_id' => 3],
        ]);

        foreach ([11 => 4, 12 => 4, 13 => 4, 14 => 4, 15 => 5, 16 => 4] as $user => $type) {
            DB::table('user_permissions')->insert(['user_id' => $user, 'permission_id' => 1, 'permission_type_id' => $type]);
        }
    }

    protected function tearDown(): void
    {
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_flag_off_notifies_admins_only(): void
    {
        $ids = PartnerFlagRecipients::resolve(1, false)->pluck('id')->sort()->values()->all();

        $this->assertSame([10, 12], $ids);
    }

    public function test_flag_on_adds_people_who_can_answer_without_duplicates(): void
    {
        $ids = PartnerFlagRecipients::resolve(1, true)->pluck('id')->sort()->values()->all();

        // 11 is the manager; 12 is an admin who also holds it, counted once.
        $this->assertSame([10, 11, 12], $ids);
    }

    public function test_flag_on_still_excludes_the_wrong_people(): void
    {
        $ids = PartnerFlagRecipients::resolve(1, true)->pluck('id')->all();

        $this->assertNotContains(13, $ids, 'inactive user');
        $this->assertNotContains(14, $ids, 'other company');
        $this->assertNotContains(15, $ids, 'permission held as none');
        $this->assertNotContains(16, $ids, 'partner-only account');
    }

    public function test_other_company_sees_only_its_own(): void
    {
        $this->assertSame([], PartnerFlagRecipients::resolve(2, false)->pluck('id')->all());
        $this->assertSame([14], PartnerFlagRecipients::resolve(2, true)->pluck('id')->all());
    }

    /** @dataProvider destinations */
    public function test_email_destination(bool $routed, bool $managerFlag, mixed $permission, string $expected): void
    {
        $this->assertSame($expected, PartnerFlagRaised::destination($routed, $managerFlag, $permission)[0]);
    }

    /** @return array<string, array{0: bool, 1: bool, 2: mixed, 3: string}> */
    public static function destinations(): array
    {
        return [
            // Routing off: always the Manager dashboard, as before.
            'off, no permission' => [false, false, false, 'dashboard.v2'],
            'off, permission' => [false, true, 'all', 'dashboard.v2'],
            // Routing on: only if the recipient can really open it.
            'on, can open' => [true, true, 'all', 'dashboard.v2'],
            'on, no permission' => [true, true, 'none', 'dashboard'],
            'on, permission but dashboard flag off' => [true, false, 'all', 'dashboard'],
            'on, permission missing entirely' => [true, true, false, 'dashboard'],
        ];
    }
}
