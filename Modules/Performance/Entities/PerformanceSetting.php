<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;
use App\Models\Role;
use App\Traits\HasCompany;

class PerformanceSetting extends BaseModel
{

    use HasCompany;

    protected $guarded = ['id'];

    const MODULE_NAME = 'performance';

    public static function addModuleSetting($company)
    {
        $roles = ['employee', 'admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);
    }

    public function getCreateMeetingRolesNamewAttribute()
    {
        $roles = Role::all()->keyBy('id');
        $viewByRoles = json_decode($this->create_meeting_roles);

        $roleNames = [];

        if (is_array($viewByRoles) || is_object($viewByRoles)) {
            $roleNames = array_map(function($roleId) use ($roles) {
                return $roles[$roleId]->display_name ?? '--';
            }, (array)$viewByRoles);
        }

        if ($this->create_meeting_manager == 1) {
            $roleNames[] = __('performance::app.reportingManager');
        }

        return $roleNames;
    }

    public function getViewMeetingRolesNamesAttribute()
    {
        $roles = Role::all()->keyBy('id');
        $manageByRoles = json_decode($this->view_meeting_roles);

        $roleNames = [];

        if (is_array($manageByRoles) || is_object($manageByRoles)) {
            $roleNames = array_map(function($roleId) use ($roles) {
                return $roles[$roleId]->display_name ?? '--';
            }, (array)$manageByRoles);
        }

        if ($this->create_meeting_manager == 1) {
            $roleNames[] = __('performance::app.reportingManager');
        }

        if ($this->view_meeting_by_participant == 1) {
            $roleNames[] = __('performance::modules.participantsOnly');
        }

        return $roleNames;
    }

}
