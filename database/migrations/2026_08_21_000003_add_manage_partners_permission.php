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
 * Adds manage_partners: view/manage the partner roster (toggling agents
 * partner/non-partner) and its stats, separate from manage_partner_network
 * (MLM hierarchy admin) and manage_partner_flags (resolving partner flags).
 *
 * Mirrors 2026_08_09_000004_add_manage_partner_flags_permission — both
 * permission_role AND user_permissions are written, because
 * User::permission() reads user_permissions only.
 */
return new class extends Migration
{
    private const PERMISSION = 'manage_partners';

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
                'display_name' => 'Manage Partners',
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
