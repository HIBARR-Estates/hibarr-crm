<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $module = Module::where('module_name', 'leads')->first();

        if (!$module) {
            return;
        }

        $permission = Permission::updateOrCreate(
            [
                'name' => 'manage_qualification_mapping',
                'module_id' => $module->id,
            ],
            [
                'display_name' => 'Manage Qualification Field Mapping',
                'allowed_permissions' => Permission::ALL_NONE,
                'is_custom' => 1,
            ]
        );

        $companies = Company::select('id')->get();

        foreach ($companies as $company) {
            $role = Role::where('name', 'admin')
                ->where('company_id', $company->id)
                ->first();

            if ($role) {
                $permissionRole = PermissionRole::where('permission_id', $permission->id)
                    ->where('role_id', $role->id)
                    ->first() ?: new PermissionRole();
                $permissionRole->permission_id = $permission->id;
                $permissionRole->role_id = $role->id;
                $permissionRole->permission_type_id = 4; // All
                $permissionRole->save();
            }
        }

        foreach (User::allAdmins() as $adminUser) {
            $userPermission = UserPermission::where('user_id', $adminUser->id)
                ->where('permission_id', $permission->id)
                ->first() ?: new UserPermission();
            $userPermission->user_id = $adminUser->id;
            $userPermission->permission_id = $permission->id;
            $userPermission->permission_type_id = 4; // All
            $userPermission->save();
        }

        // HandleInertiaRequests caches the permission-name list for 24h; without
        // this the new key never reaches the frontend and the gate reads false.
        cache()->forget('all_permissions_list');
    }

    public function down(): void
    {
        $module = Module::where('module_name', 'leads')->first();

        if (!$module) {
            return;
        }

        $permission = Permission::where('name', 'manage_qualification_mapping')
            ->where('module_id', $module->id)
            ->first();

        if (!$permission) {
            return;
        }

        PermissionRole::where('permission_id', $permission->id)->delete();
        UserPermission::where('permission_id', $permission->id)->delete();
        $permission->delete();

        cache()->forget('all_permissions_list');
    }
};
