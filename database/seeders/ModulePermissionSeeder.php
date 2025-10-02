<?php

namespace Database\Seeders;

use App\Models\Module;
use App\Models\Permission;
use App\Models\Company;
use App\Models\Role;
use App\Models\PermissionRole;
use App\Models\User;
use App\Models\UserPermission;
use Illuminate\Database\Seeder;

class ModulePermissionSeeder extends Seeder
{

    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $this->permissionTypes();

        $modules = Module::MODULE_LIST;

        foreach ($modules as $module) {
            $insert = Module::updateOrCreate(
                ['module_name' => $module['module_name']],
                ['description' => $module['description'] ?? null]
            );


            // Run for every permissions
            foreach ($module['permissions'] as $permission) {
                $permission['module_id'] = $insert->id;
                $permission['display_name'] = $permission['display_name'] ?? ucwords(str_replace('_', ' ', $permission['name']));

                $concernedPermission = Permission::updateOrCreate(
                    ['module_id' => $permission['module_id'], 'name' => $permission['name']],
                    $permission
                );

                // Give admin roles full access
                $this->giveAdminAccess($concernedPermission);

            }
        }
    }

    private function permissionTypes()
    {
        // Add check to avoid duplicate entries
        $existingTypes = \DB::table('permission_types')->pluck('name')->toArray();

        $newTypes = [
            ['name' => 'added'],
            ['name' => 'owned'],
            ['name' => 'both'],
            ['name' => 'all'],
            ['name' => 'none']
        ];

        $typesToInsert = array_filter($newTypes, function ($type) use ($existingTypes) {
            return !in_array($type['name'], $existingTypes);
        });

        \DB::table('permission_types')->insert($typesToInsert);
    }

    /**
     * Give admin users and roles full access to the permission
     */
    private function giveAdminAccess(Permission $permission): void
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            $role = Role::where('name', 'admin')
                ->where('company_id', $company->id)
                ->first();

            if ($role) {
                $permissionRole = PermissionRole::updateOrCreate(
                    [
                        'permission_id' => $permission->id,
                        'role_id' => $role->id,
                    ],
                    [
                        'permission_type_id' => 4, // All
                    ]
                );
            }
        }

        $adminUsers = User::allAdmins();

        foreach ($adminUsers as $adminUser) {
            UserPermission::updateOrCreate(
                [
                    'user_id' => $adminUser->id,
                    'permission_id' => $permission->id,
                ],
                [
                    'permission_type_id' => 4, // All
                ]
            );
        }
    }



}
