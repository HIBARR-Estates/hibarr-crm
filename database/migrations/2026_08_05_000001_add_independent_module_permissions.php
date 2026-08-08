<?php

use App\Models\Company;
use App\Models\Module;
use App\Models\ModuleSetting;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Split Partner Network / Offers / Properties admin out of the overloaded edit_product SM check.
     *
     * Existing users/roles with edit_product = all are granted the new permissions so access is preserved,
     * then can be managed independently in Role Permissions.
     */
    public function up(): void
    {
        $definitions = [
            [
                'module_name' => 'partner_network',
                'description' => 'Partner Network (MLM) admin module — levels, commissions, hierarchy, cycles.',
                'permissions' => [
                    [
                        'name' => 'manage_partner_network',
                        'display_name' => 'Manage Partner Network',
                        'allowed_permissions' => Permission::ALL_NONE,
                        'is_custom' => 0,
                    ],
                ],
            ],
            [
                'module_name' => 'offers',
                'description' => 'Developer / project offers management.',
                'permissions' => [
                    [
                        'name' => 'manage_offers',
                        'display_name' => 'Manage Offers',
                        'allowed_permissions' => Permission::ALL_NONE,
                        'is_custom' => 0,
                    ],
                ],
            ],
            [
                'module_name' => 'properties',
                'description' => 'Property inventory and related workflows (manage properties, publish requests, configuration).',
                'permissions' => [
                    [
                        'name' => 'manage_properties',
                        'display_name' => 'Manage Properties',
                        'allowed_permissions' => Permission::ALL_NONE,
                        'is_custom' => 0,
                    ],
                    [
                        'name' => 'manage_property_publish_requests',
                        'display_name' => 'Manage Property Publish Requests',
                        'allowed_permissions' => Permission::ALL_NONE,
                        'is_custom' => 0,
                    ],
                    [
                        'name' => 'manage_property_configuration',
                        'display_name' => 'Manage Property Configuration',
                        'allowed_permissions' => Permission::ALL_NONE,
                        'is_custom' => 0,
                    ],
                ],
            ],
        ];

        $companies = Company::select('id')->get();
        $createdPermissions = collect();

        foreach ($definitions as $definition) {
            $module = Module::updateOrCreate(
                ['module_name' => $definition['module_name']],
                ['description' => $definition['description']]
            );

            foreach ($companies as $company) {
                foreach (['admin', 'employee'] as $type) {
                    ModuleSetting::updateOrCreate(
                        [
                            'company_id' => $company->id,
                            'module_name' => $module->module_name,
                            'type' => $type,
                        ],
                        ['status' => 'active']
                    );
                }
            }

            foreach ($definition['permissions'] as $permissionData) {
                $permission = Permission::updateOrCreate(
                    [
                        'name' => $permissionData['name'],
                        'module_id' => $module->id,
                    ],
                    [
                        'display_name' => $permissionData['display_name'],
                        'allowed_permissions' => $permissionData['allowed_permissions'],
                        'is_custom' => $permissionData['is_custom'],
                    ]
                );

                $createdPermissions->push($permission);
            }
        }

        // Grant to company admin roles + all admin users
        foreach ($createdPermissions as $permission) {
            foreach ($companies as $company) {
                $adminRole = Role::where('name', 'admin')
                    ->where('company_id', $company->id)
                    ->first();

                if ($adminRole) {
                    PermissionRole::updateOrCreate(
                        [
                            'permission_id' => $permission->id,
                            'role_id' => $adminRole->id,
                        ],
                        ['permission_type_id' => 4]
                    );
                }

                foreach (User::allAdmins($company->id) as $adminUser) {
                    UserPermission::updateOrCreate(
                        [
                            'user_id' => $adminUser->id,
                            'permission_id' => $permission->id,
                        ],
                        ['permission_type_id' => 4]
                    );
                }
            }
        }

        // Migrate former SMs who were gated via edit_product = all
        $legacyPermissionIds = Permission::whereIn('name', ['edit_product', 'edit_products'])
            ->pluck('id');

        if ($legacyPermissionIds->isEmpty()) {
            $this->clearPermissionListCache();

            return;
        }

        $legacyUserIds = UserPermission::whereIn('permission_id', $legacyPermissionIds)
            ->where('permission_type_id', 4)
            ->pluck('user_id')
            ->unique();

        foreach ($legacyUserIds as $userId) {
            foreach ($createdPermissions as $permission) {
                UserPermission::updateOrCreate(
                    [
                        'user_id' => $userId,
                        'permission_id' => $permission->id,
                    ],
                    ['permission_type_id' => 4]
                );
            }
        }

        $legacyRoleIds = PermissionRole::whereIn('permission_id', $legacyPermissionIds)
            ->where('permission_type_id', 4)
            ->pluck('role_id')
            ->unique();

        foreach ($legacyRoleIds as $roleId) {
            foreach ($createdPermissions as $permission) {
                PermissionRole::updateOrCreate(
                    [
                        'permission_id' => $permission->id,
                        'role_id' => $roleId,
                    ],
                    ['permission_type_id' => 4]
                );
            }
        }

        $this->clearPermissionListCache();
    }

    public function down(): void
    {
        $permissionNames = [
            'manage_partner_network',
            'manage_offers',
            'manage_properties',
            'manage_property_admin', // legacy alias if partially migrated
            'manage_property_publish_requests',
            'manage_property_configuration',
        ];

        $permissions = Permission::whereIn('name', $permissionNames)->get();

        foreach ($permissions as $permission) {
            PermissionRole::where('permission_id', $permission->id)->delete();
            UserPermission::where('permission_id', $permission->id)->delete();
            $permission->delete();
        }

        $moduleNames = ['partner_network', 'offers', 'properties'];

        ModuleSetting::whereIn('module_name', $moduleNames)->delete();
        Module::whereIn('module_name', $moduleNames)->delete();

        $this->clearPermissionListCache();
    }

    private function clearPermissionListCache(): void
    {
        cache()->forget('all_permissions_list');
    }
};
