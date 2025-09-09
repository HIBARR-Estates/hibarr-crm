<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\Team;
use App\Models\User;
use App\Models\Project;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Objective extends BaseModel
{

    use HasCompany;

    public function keyResults(): HasMany
    {
        return $this->hasMany(KeyResults::class, 'objective_id');
    }

    public function status(): HasOne
    {
        return $this->hasOne(ObjectiveProgressStatus::class, 'objective_id');
    }

    public function goalType()
    {
        return $this->belongsTo(GoalType::class, 'goal_type');
    }

    public function department()
    {
        return $this->belongsTo(Team::class, 'department_id');
    }

    public function addedBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function project()
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function owners()
    {
        return $this->belongsToMany(User::class, 'objective_owners', 'objective_id', 'owner_id');
    }

}
