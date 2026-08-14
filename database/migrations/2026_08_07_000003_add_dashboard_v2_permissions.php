<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Adds the four role-scoped v2 dashboard permissions for existing companies.
 * New companies get them from Module::MODULE_LIST via ModulePermissionSeeder.
 *
 * Grants are independent so a user can hold several views at once — the brief's
 * requirement that leadership see both the agent and leadership dashboards.
 * Default role mapping below is a starting point, not a policy; admins can
 * regrant per user afterwards.
 */
return new class extends Migration
{
    /** permission name => roles that get it by default */
    private const GRANTS = [
        'view_agent_dashboard' => ['admin', 'sales-agent', 'field-sales-agent', 'sales-manager', 'leadership'],
        'view_manager_dashboard' => ['admin', 'sales-manager', 'leadership'],
        'view_leadership_dashboard' => ['admin', 'leadership'],
        'view_partner_dashboard' => ['admin'],
    ];

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $companies = Company::select('id')->get();
        $admins = User::allAdmins();

        foreach (self::GRANTS as $permissionName => $roleNames) {
            $permission = Permission::firstOrCreate(
                ['name' => $permissionName],
                [
                    'display_name' => ucwords(str_replace('_', ' ', $permissionName)),
                    'is_custom' => 1,
                    'module_id' => $module->id,
                    'allowed_permissions' => Permission::ALL_NONE,
                ]
            );

            foreach ($companies as $company) {
                $roles = Role::where('company_id', $company->id)
                    ->whereIn('name', $roleNames)
                    ->get();

                foreach ($roles as $role) {
                    PermissionRole::firstOrCreate([
                        'permission_id' => $permission->id,
                        'role_id' => $role->id,
                    ], [
                        'permission_type_id' => 4, // All
                    ]);
                }
            }

            // Admins are granted directly as well — role membership alone doesn't
            // populate user_permissions, which is what user()->permission() reads.
            foreach ($admins as $admin) {
                UserPermission::firstOrCreate([
                    'user_id' => $admin->id,
                    'permission_id' => $permission->id,
                ], [
                    'permission_type_id' => 4, // All
                ]);
            }
        }
    }

    public function down(): void
    {
        $permissions = Permission::whereIn('name', array_keys(self::GRANTS))->get();

        foreach ($permissions as $permission) {
            PermissionRole::where('permission_id', $permission->id)->delete();
            UserPermission::where('permission_id', $permission->id)->delete();
            $permission->delete();
        }
    }
};
