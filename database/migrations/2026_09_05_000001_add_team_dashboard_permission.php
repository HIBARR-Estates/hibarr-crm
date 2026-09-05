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
 * Adds view_team_dashboard for existing companies.
 *
 * Same shape as 2026_08_07_000003, which seeded the other four v2 dashboard
 * permissions — new companies get this one from Module::MODULE_LIST via
 * ModulePermissionSeeder, so this file only exists to backfill the ones that
 * already ran that seeder.
 *
 * The grant is a starting point, not a policy: admins can regrant per user
 * afterwards. It is also not the only gate — the view stays unavailable until
 * the crm.team-dashboard flag is on, because this is the first surface to show
 * commission across a whole hierarchy and it rolls out per manager.
 */
return new class extends Migration
{
    private const PERMISSION = 'view_team_dashboard';

    /** Roles that get the permission by default. */
    private const ROLES = ['admin', 'sales-manager', 'leadership'];

    public function up(): void
    {
        $module = Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $permission = Permission::firstOrCreate(
            ['name' => self::PERMISSION],
            [
                'display_name' => ucwords(str_replace('_', ' ', self::PERMISSION)),
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
                    'permission_type_id' => 4, // All
                ]);
            }
        }

        // Admins are granted directly as well — role membership alone doesn't
        // populate user_permissions, which is what user()->permission() reads.
        foreach (User::allAdmins() as $admin) {
            UserPermission::firstOrCreate([
                'user_id' => $admin->id,
                'permission_id' => $permission->id,
            ], [
                'permission_type_id' => 4, // All
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
