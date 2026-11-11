<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Adds make_softphone_calls for existing companies.
 *
 * Mirrors 2026_08_09_000004: both permission_role AND user_permissions are
 * written, because User::permission() reads user_permissions only.
 */
return new class extends Migration
{
    private const PERMISSION = 'make_softphone_calls';

    /** Roles that may place softphone calls. */
    private const ROLES = ['admin'];

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => 'Make Softphone Calls',
                'is_custom' => 1,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_NONE,
            ]
        );

        // New companies are covered by the observer-driven permission sync on
        // creation; this migration only needs to backfill existing companies.
        foreach (Company::select('id')->get() as $company) {
            $roles = Role::where('company_id', $company->id)
                ->whereIn('name', self::ROLES)
                ->get();

            foreach ($roles as $role) {
                PermissionRole::firstOrCreate([
                    'permission_id' => $permission->id,
                    'role_id' => $role->id,
                ], [
                    'permission_type_id' => PermissionType::ALL,
                ]);
            }
        }

        foreach (User::allAdmins() as $admin) {
            UserPermission::firstOrCreate([
                'user_id' => $admin->id,
                'permission_id' => $permission->id,
            ], [
                'permission_type_id' => PermissionType::ALL,
            ]);
        }
    }

    public function down(): void
    {
        $permission = Permission::where('name', self::PERMISSION)->first();

        if (is_null($permission)) {
            return;
        }

        PermissionRole::where('permission_id', $permission->id)->delete();
        UserPermission::where('permission_id', $permission->id)->delete();
        $permission->delete();
    }
};
