<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Module;
use App\Models\PermissionRole;

class DeveloperRolePermissionsSeeder extends Seeder
{
    public function run()
    {
        // Get or create roles (admin already handled by ModulePermissionSeeder)
        $salesAgent = Role::firstOrCreate(['name' => 'sales_agent'], ['display_name' => 'Sales Agent', 'company_id' => 1]);
        $salesManager = Role::firstOrCreate(['name' => 'sales_manager'], ['display_name' => 'Sales Manager', 'company_id' => 1]);
        $mediaTeam = Role::firstOrCreate(['name' => 'media_team'], ['display_name' => 'Media Team', 'company_id' => 1]);
        $mediaTeamLead = Role::firstOrCreate(['name' => 'media_team_lead'], ['display_name' => 'Media Team Lead', 'company_id' => 1]);

        // Get all developer-related modules from Module::MODULE_LIST
        $developerModuleNames = collect(Module::MODULE_LIST)
            ->filter(function ($module) {
                return in_array($module['module_name'], ['developers', 'developer_projects']);
            })
            ->pluck('module_name')
            ->toArray();

        // Get the actual module records from database
        $developerModules = Module::whereIn('module_name', $developerModuleNames)->get();

        foreach ($developerModules as $module) {
            // Get all permissions for this module
            $permissions = Permission::where('module_id', $module->id)->get();

            foreach ($permissions as $permission) {
                $this->assignRolePermissions($permission, [
                    $salesAgent,
                    $salesManager, 
                    $mediaTeam,
                    $mediaTeamLead
                ]);
            }
        }

        $this->command->info('Developer role permissions seeded successfully!');
    }

    /**
     * Assign permissions to roles based on permission name
     */
    private function assignRolePermissions(Permission $permission, array $roles)
    {
        $permissionMapping = $this->getPermissionMapping($permission->name);

        foreach ($roles as $role) {
            if (isset($permissionMapping[$role->name])) {
                PermissionRole::updateOrCreate(
                    [
                        'permission_id' => $permission->id,
                        'role_id' => $role->id,
                    ],
                    [
                        'permission_type_id' => $permissionMapping[$role->name],
                    ]
                );
            }
        }
    }

    /**
     * Get permission mapping for each role based on permission name
     */
    private function getPermissionMapping(string $permissionName): array
    {
        // Base mapping for most permissions
        $baseMapping = [
            'sales_agent' => 5,      // None
            'sales_manager' => 4,    // All  
            'media_team_lead' => 4,  // All
        ];

        // Permission-specific mappings
        $permissionMappings = [
            // Developer permissions
            'view_developers' => array_merge($baseMapping, [
                'sales_agent' => 2,    // Owned (can view assigned developers)
                'media_team' => 1,     // Added (can view own created developers)
            ]),
            'add_developers' => array_merge($baseMapping, [
                'media_team' => 1,     // Added (can add developers)
            ]),
            'edit_developers' => array_merge($baseMapping, [
                'media_team' => 1,     // Added (can edit own developers)
            ]),
            'delete_developers' => $baseMapping, // Media team gets 'none' by default

            // Developer Project permissions (same pattern)
            'view_developer_projects' => array_merge($baseMapping, [
                'sales_agent' => 2,    // Owned
                'media_team' => 1,     // Added
            ]),
            'add_developer_projects' => array_merge($baseMapping, [
                'media_team' => 1,     // Added
            ]),
            'edit_developer_projects' => array_merge($baseMapping, [
                'media_team' => 1,     // Added
            ]),
            'delete_developer_projects' => $baseMapping, // Media team gets 'none'
        ];

        return $permissionMappings[$permissionName] ?? $baseMapping;
    }
}