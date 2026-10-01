<?php

namespace Tests\Feature\Partners;

use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Support\PartnerRole;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The partner role grants the partner dashboard and nothing else, with an
 * explicit "none" row for every other permission — a missing row reads as
 * false, and some checks only compare against 'none'.
 */
class PartnerRoleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('display_name')->nullable();
            $table->string('description')->nullable();
            $table->timestamps();
        });
        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->unsignedInteger('module_id')->nullable();
            $table->string('allowed_permissions')->nullable();
            $table->boolean('is_custom')->default(0);
            $table->timestamps();
        });
        Schema::create('permission_role', function (Blueprint $table) {
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('role_id');
            $table->unsignedInteger('permission_type_id');
        });

        foreach (['view_partner_dashboard', 'view_lead', 'view_tasks', 'view_products', 'manage_partner_network'] as $name) {
            DB::table('permissions')->insert(['name' => $name]);
        }
    }

    protected function tearDown(): void
    {
        foreach (['permission_role', 'permissions', 'roles'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_role_grants_only_the_partner_dashboard(): void
    {
        $role = PartnerRole::ensureFor(1);

        $types = PermissionRole::where('role_id', $role->id)
            ->join('permissions', 'permissions.id', '=', 'permission_role.permission_id')
            ->pluck('permission_type_id', 'permissions.name');

        $this->assertSame(PermissionType::ALL, (int) $types['view_partner_dashboard']);

        foreach (['view_lead', 'view_tasks', 'view_products', 'manage_partner_network'] as $name) {
            $this->assertSame(PermissionType::NONE, (int) $types[$name], "$name should be none");
        }

        $this->assertCount(Permission::count(), $types);
    }

    public function test_ensure_is_idempotent_and_scoped_per_company(): void
    {
        $first = PartnerRole::ensureFor(1);
        $again = PartnerRole::ensureFor(1);
        $other = PartnerRole::ensureFor(2);

        $this->assertSame($first->id, $again->id);
        $this->assertNotSame($first->id, $other->id);
        $this->assertSame(2, Role::withoutGlobalScopes()->where('name', 'partner')->count());
        $this->assertSame(Permission::count(), PermissionRole::where('role_id', $first->id)->count());
    }

    public function test_ensure_repairs_a_widened_role(): void
    {
        $role = PartnerRole::ensureFor(1);
        $lead = Permission::where('name', 'view_lead')->value('id');

        PermissionRole::where('role_id', $role->id)->where('permission_id', $lead)
            ->update(['permission_type_id' => PermissionType::ALL]);

        PartnerRole::ensureFor(1);

        $this->assertSame(
            PermissionType::NONE,
            (int) PermissionRole::where('role_id', $role->id)->where('permission_id', $lead)->value('permission_type_id')
        );
    }
}
