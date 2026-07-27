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
                'name' => 'merge_lead',
                'module_id' => $module->id,
            ],
            [
                'display_name' => 'Merge Lead',
                'allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5,
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
    }

    public function down(): void
    {
        $module = Module::where('module_name', 'leads')->first();

        if (!$module) {
            return;
        }

        $permission = Permission::where('name', 'merge_lead')
            ->where('module_id', $module->id)
            ->first();

        if (!$permission) {
            return;
        }

        PermissionRole::where('permission_id', $permission->id)->delete();
        UserPermission::where('permission_id', $permission->id)->delete();
        $permission->delete();
    }
};
