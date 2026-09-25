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
 * Confirming a deal payment request's bank transfer is gated on
 * edit_payments = all, and User::permission() reads user_permissions only —
 * there is no role join — so an admin whose row is missing (or was seeded
 * lower than "all") could not confirm. Same permission_role +
 * user_permissions shape as 2026_08_21_000003_add_manage_partners_permission.
 *
 * Unlike that file, edit_payments is a core Worksuite permission rather than a
 * new one: existing admin rows are upgraded to "all" (not just created when
 * absent), and down() deliberately leaves the permission in place.
 */
return new class extends Migration
{
    private const PERMISSION = 'edit_payments';

    public function up(): void
    {
        $module = Module::where('module_name', 'payments')->first();

        if (is_null($module)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => 'Edit Payments',
                'is_custom' => 0,
                'module_id' => $module->id,
                'allowed_permissions' => Permission::ALL_4_ADDED_1_OWNED_2_BOTH_3_NONE_5,
            ]
        );

        foreach (Company::select('id')->get() as $company) {
            $roles = Role::where('company_id', $company->id)
                ->where('name', 'admin')
                ->get();

            foreach ($roles as $role) {
                PermissionRole::updateOrCreate([
                    'permission_id' => $permission->id,
                    'role_id' => $role->id,
                ], [
                    'permission_type_id' => PermissionType::ALL,
                ]);
            }
        }

        foreach (User::allAdmins() as $admin) {
            UserPermission::updateOrCreate([
                'user_id' => $admin->id,
                'permission_id' => $permission->id,
            ], [
                'permission_type_id' => PermissionType::ALL,
            ]);
        }
    }

    public function down(): void
    {
        // Core permission — the grant is not reverted.
    }
};
