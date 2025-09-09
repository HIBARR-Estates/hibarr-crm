<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\Role;
use App\Traits\HasCompany;

class GoalType extends BaseModel
{
    use HasCompany;

    public static function defaultGoalTypes($company)
    {
        return [
            [
                'company_id' => $company->id,
                'type' => 'individual',
                'view_by_owner' => 1,
                'manage_by_owner' => 1,
                'view_by_manager' => 0,
                'manage_by_manager' => 0,
                'view_by_roles' => json_encode([]),
                'manage_by_roles' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_id' => $company->id,
                'type' => 'department',
                'view_by_owner' => 1,
                'manage_by_owner' => 1,
                'view_by_manager' => 0,
                'manage_by_manager' => 0,
                'view_by_roles' => json_encode([]),
                'manage_by_roles' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'company_id' => $company->id,
                'type' => 'company',
                'view_by_owner' => 1,
                'manage_by_owner' => 1,
                'view_by_manager' => 0,
                'manage_by_manager' => 0,
                'view_by_roles' => json_encode([]),
                'manage_by_roles' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];
    }

    public function getViewByRolesNamesAttribute()
    {
        $roles = Role::all()->keyBy('id');
        $viewByRoles = json_decode($this->view_by_roles);

        $roleNames = [];

        if (is_array($viewByRoles) || is_object($viewByRoles)) {
            $roleNames = array_map(function ($roleId) use ($roles) {
                return $roles[$roleId]->display_name ?? '--';
            }, (array)$viewByRoles);
        }

        if ($this->view_by_owner == 1) {
            $roleNames[] = __('performance::app.owner');
        }

        if ($this->view_by_manager == 1) {
            $roleNames[] = __('performance::app.reportingManager');
        }

        return $roleNames;
    }

    public function getManageByRolesNamesAttribute()
    {
        $roles = Role::all()->keyBy('id');
        $manageByRoles = json_decode($this->manage_by_roles);

        $roleNames = [];

        if (is_array($manageByRoles) || is_object($manageByRoles)) {
            $roleNames = array_map(function ($roleId) use ($roles) {
                return $roles[$roleId]->display_name ?? '--';
            }, (array)$manageByRoles);
        }

        if ($this->manage_by_owner == 1) {
            $roleNames[] = __('performance::app.owner');
        }

        if ($this->manage_by_manager == 1) {
            $roleNames[] = __('performance::app.reportingManager');
        }

        return $roleNames;
    }

    public function objectives()
    {
        return $this->hasMany(Objective::class, 'goal_type');
    }
}
