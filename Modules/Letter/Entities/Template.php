<?php

namespace Modules\Letter\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;

class Template extends BaseModel
{
    // region Properties
    use HasCompany;

    protected $table = 'letter_templates';

    protected $fillable = [
        'title', 'description'
    ];


    //endregion



    //endregion

    //region Custom Attributes

    /* ---------- */

    public function getEmployeeVariablesAttribute(): array
    {
        $employee = new User();
        return $employee->getVariables();
    }

    //endregion

    //region Relations

    /* ---------- */

    //endregion

    //region Custom Functions

}
