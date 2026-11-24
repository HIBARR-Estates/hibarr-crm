<?php

use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Registers the five CRM suppression permissions (SUP-D13 / HIB-1901):
 * - view_suppression_restrictions
 * - block_suppressions
 * - lift_suppressions
 * - lift_restricted_suppressions
 * - view_full_suppression_details
 *
 * Admins start with `all`; every other role starts at `none` and is granted
 * from Roles & permissions. Both permission_role and user_permissions are
 * written because User::permission() reads user_permissions.
 */
return new class extends Migration
{
    /**
     * @var array<int, array{name: string, display_name: string}>
     */
    private const PERMISSIONS = [
        [
            'name' => 'view_suppression_restrictions',
            'display_name' => 'View Suppression Restrictions',
        ],
        [
            'name' => 'block_suppressions',
            'display_name' => 'Block Contacts (Suppression)',
        ],
        [
            'name' => 'lift_suppressions',
            'display_name' => 'Lift Suppression Blocks',
        ],
        [
            'name' => 'lift_restricted_suppressions',
            'display_name' => 'Lift Restricted Suppressions',
        ],
        [
            'name' => 'view_full_suppression_details',
            'display_name' => 'View Full Suppression Contact Details',
        ],
    ];

    public function up(): void
    {
        $module = Module::where('module_name', 'leads')->first()
            ?? Module::where('module_name', 'dashboards')->first();

        if (is_null($module)) {
            return;
        }

        $roles = Role::select(['id', 'name'])->get();
        $admins = User::allAdmins();

        foreach (self::PERMISSIONS as $definition) {
            $permission = Permission::firstOrCreate(
                ['name' => $definition['name']],
                [
                    'display_name' => $definition['display_name'],
                    'is_custom' => 1,
                    'module_id' => $module->id,
                    'allowed_permissions' => Permission::ALL_NONE,
                ]
            );

            foreach ($roles as $role) {
                PermissionRole::firstOrCreate(
                    [
                        'permission_id' => $permission->id,
                        'role_id' => $role->id,
                    ],
                    [
                        'permission_type_id' => $role->name === 'admin'
                            ? PermissionType::ALL
                            : PermissionType::NONE,
                    ]
                );
            }

            foreach ($admins as $admin) {
                UserPermission::firstOrCreate(
                    [
                        'user_id' => $admin->id,
                        'permission_id' => $permission->id,
                    ],
                    [
                        'permission_type_id' => PermissionType::ALL,
                    ]
                );
            }
        }

        cache()->forget('all_permissions_list');
    }

    public function down(): void
    {
        $names = array_column(self::PERMISSIONS, 'name');
        $permissions = Permission::whereIn('name', $names)->get();

        foreach ($permissions as $permission) {
            PermissionRole::where('permission_id', $permission->id)->delete();
            UserPermission::where('permission_id', $permission->id)->delete();
            $permission->delete();
        }

        cache()->forget('all_permissions_list');
    }
};
