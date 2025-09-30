<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;
use App\Models\Module;

class DeveloperRolePermissionsSeeder extends Seeder
{
    public function run()
    {
        // Get or create roles
        $salesAgent = Role::firstOrCreate(['name' => 'sales_agent'], ['display_name' => 'Sales Agent']);
        $salesManager = Role::firstOrCreate(['name' => 'sales_manager'], ['display_name' => 'Sales Manager']);
        $mediaTeam = Role::firstOrCreate(['name' => 'media_team'], ['display_name' => 'Media Team']);
        $mediaTeamLead = Role::firstOrCreate(['name' => 'media_team_lead'], ['display_name' => 'Media Team Lead']);

        // Get developer module
        $developerModule = Module::where('module_name', 'developers')->first();
        
        if ($developerModule) {
            $permissions = Permission::where('module_id', $developerModule->id)->get();

            foreach ($permissions as $permission) {
                switch ($permission->name) {
                    case 'view_developers':
                        // Sales Agent: Read only (owned level)
                        $salesAgent->attachPermission($permission, ['permission_type' => 2]); // owned
                        
                        // Sales Manager: Full access
                        $salesManager->attachPermission($permission, ['permission_type' => 4]); // all
                        
                        // Media Team: Can view their own
                        $mediaTeam->attachPermission($permission, ['permission_type' => 1]); // added
                        
                        // Media Team Lead: Full access
                        $mediaTeamLead->attachPermission($permission, ['permission_type' => 4]); // all
                        break;

                    case 'add_developers':
                        // Sales Agent: No permission
                        $salesAgent->attachPermission($permission, ['permission_type' => 5]); // none
                        
                        // Sales Manager: Full permission
                        $salesManager->attachPermission($permission, ['permission_type' => 4]); // all
                        
                        // Media Team: Can add
                        $mediaTeam->attachPermission($permission, ['permission_type' => 1]); // added
                        
                        // Media Team Lead: Full permission
                        $mediaTeamLead->attachPermission($permission, ['permission_type' => 4]); // all
                        break;

                    case 'edit_developers':
                        // Sales Agent: No permission
                        $salesAgent->attachPermission($permission, ['permission_type' => 5]); // none
                        
                        // Sales Manager: Full permission
                        $salesManager->attachPermission($permission, ['permission_type' => 4]); // all
                        
                        // Media Team: Can edit their own
                        $mediaTeam->attachPermission($permission, ['permission_type' => 1]); // added
                        
                        // Media Team Lead: Full permission
                        $mediaTeamLead->attachPermission($permission, ['permission_type' => 4]); // all
                        break;

                    case 'delete_developers':
                        // Sales Agent: No permission
                        $salesAgent->attachPermission($permission, ['permission_type' => 5]); // none
                        
                        // Sales Manager: Full permission
                        $salesManager->attachPermission($permission, ['permission_type' => 4]); // all
                        
                        // Media Team: No delete permission
                        $mediaTeam->attachPermission($permission, ['permission_type' => 5]); // none
                        
                        // Media Team Lead: Full permission
                        $mediaTeamLead->attachPermission($permission, ['permission_type' => 4]); // all
                        break;
                }
            }
        }
    }
}