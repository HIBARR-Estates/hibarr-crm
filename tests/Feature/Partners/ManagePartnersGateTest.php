<?php

namespace Tests\Feature\Partners;

use App\Models\PermissionType;
use App\Models\User;
use App\Support\PermissionGates;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ManagePartnersGateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('permission_types');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

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
        Schema::create('permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
        });
        Schema::create('permission_types', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
        });
        Schema::create('user_permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('permission_type_id');
        });

        DB::table('companies')->insert(['id' => 1, 'company_name' => 'One']);
        DB::table('permission_types')->insert([
            ['id' => PermissionType::ALL, 'name' => 'all'],
            ['id' => PermissionType::NONE, 'name' => 'none'],
        ]);
        DB::table('permissions')->insert(['id' => 1, 'name' => PermissionGates::MANAGE_PARTNERS]);
        DB::table('users')->insert([
            ['id' => 10, 'company_id' => 1, 'name' => 'Holder', 'email' => 'a@x.test', 'status' => 'active'],
            ['id' => 11, 'company_id' => 1, 'name' => 'Denied', 'email' => 'b@x.test', 'status' => 'active'],
        ]);
        DB::table('user_permissions')->insert([
            'user_id' => 10,
            'permission_id' => 1,
            'permission_type_id' => PermissionType::ALL,
        ]);
    }

    public function test_manage_partners_is_granted_only_at_all_scope(): void
    {
        $holder = User::withoutGlobalScopes()->findOrFail(10);
        $denied = User::withoutGlobalScopes()->findOrFail(11);

        $this->assertTrue(PermissionGates::canManagePartners($holder));
        $this->assertFalse(PermissionGates::canManagePartners($denied));
    }
}
