<?php

namespace Modules\Performance\Listeners;

use App\Models\Company;
use App\Models\Module;
use App\Models\Permission;
use App\Models\PermissionRole;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermission;
use Modules\Performance\Entities\GoalType;
use Modules\Performance\Entities\KeyResultsMetrics;
use Modules\Performance\Entities\PerformanceSetting;

class CompanyCreatedListener
{

    /**
     * Handle the event.
     *
     * @param object $event
     * @return void
     */
    public function handle($event)
    {
        $company = $event->company;
        PerformanceSetting::addModuleSetting($company);
        $this->goalTypeData($company);
        $this->keyResultsData($company);
        $this->meetingSeeting($company);
    }

    /**
     * Insert default goal types for the created company
     *
     * @param \App\Models\Company $company
     * @return void
     */
    public function goalTypeData($company)
    {
        $data = GoalType::defaultGoalTypes($company);

        GoalType::insert($data);
    }

    /**
     * Insert default key result metrics for the created company
     *
     * @param \App\Models\Company $company
     * @return void
     */
    public function keyResultsData($company)
    {
        $data = KeyResultsMetrics::defaultKeyResultsMetrics($company);

        KeyResultsMetrics::insert($data);
    }

    /**
     * Insert default key result metrics for the created company
     *
     * @param \App\Models\Company $company
     * @return void
     */
    public function meetingSeeting($company)
    {
        $meetingSeeting = PerformanceSetting::firstOrCreate(['company_id' => $company->id]);

        if ($meetingSeeting) {
            $meetingSeeting->create_meeting_manager = 1;
            $meetingSeeting->create_meeting_participant = 1;
            $meetingSeeting->view_meeting_manager = 1;
            $meetingSeeting->view_meeting_participant = 1;
            $meetingSeeting->save();
        }

        $module = Module::where('module_name', operator: 'performance')->first();

        if ($module) {

            $permission = Permission::firstOrCreate(
                [
                    'module_id' => $module->id,
                    'name' => 'view_performance_module',
                    'display_name' => 'View Performance Module',
                    'allowed_permissions' => Permission::ALL_NONE,
                    'is_custom' => 1
                ]
            );

            $role = Role::where('name', 'admin')
                ->where('company_id', $company->id)
                ->first();

            if ($role) {
                $permissionRole = PermissionRole::where('permission_id', $permission->id)
                    ->where('role_id', $role->id)
                    ->first();

                $permissionRole = $permissionRole ?: new PermissionRole();
                $permissionRole->permission_id = $permission->id;
                $permissionRole->role_id = $role->id;
                $permissionRole->permission_type_id = 4; // All
                $permissionRole->save();
            }

            $adminUsers = User::allAdmins($company->id);

            foreach ($adminUsers as $adminUser) {
                $userPermission = UserPermission::where('user_id', $adminUser->id)->where('permission_id', $permission->id)->first() ?: new UserPermission();
                $userPermission->user_id = $adminUser->id;
                $userPermission->permission_id = $permission->id;
                $userPermission->permission_type_id = 4; // All
                $userPermission->save();
            }
        }
    }
}
