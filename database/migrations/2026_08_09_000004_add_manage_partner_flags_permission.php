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
 * Adds manage_partner_flags for existing companies.
 *
 * Mirrors 2026_08_07_000003: both permission_role AND user_permissions are
 * written, because User::permission() reads user_permissions only and returns
 * false when no row exists — a role grant on its own does nothing.
 */
return new class extends Migration
{
    private const PERMISSION = 'manage_partner_flags';

    /** Roles that answer partner flags by default. */
    private const ROLES = ['admin', 'sales-manager'];

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => 'Manage Partner Flags',
                'is_custom' => 1,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_NONE,
            ]
        );

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
