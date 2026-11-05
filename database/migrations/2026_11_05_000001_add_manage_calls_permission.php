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
 * Adds manage_calls: the Calls menu, every agent's calls and every recording.
 *
 * Admins get `all` (they already see everything through the admin bypass);
 * every other role starts at `none` and is granted from Roles and permissions.
 * Both permission_role and user_permissions are written, because
 * User::permission() reads user_permissions only.
 */
return new class extends Migration
{
    private const PERMISSION = 'manage_calls';

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => 'Manage Calls',
                'is_custom' => 1,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_NONE,
            ]
        );

        foreach (Company::select('id')->get() as $company) {
            foreach (Role::where('company_id', $company->id)->get() as $role) {
                PermissionRole::firstOrCreate([
                    'permission_id' => $permission->id,
                    'role_id' => $role->id,
                ], [
                    'permission_type_id' => $role->name === 'admin' ? PermissionType::ALL : PermissionType::NONE,
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

        // HandleInertiaRequests caches the permission list for a day; drop it so
        // the new permission reaches the frontend straight away.
        cache()->forget('all_permissions_list');
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
