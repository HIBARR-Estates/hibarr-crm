<?php

namespace Modules\Biolinks\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;

class BiolinksGlobalSetting extends BaseModel
{

    protected $guarded = ['id'];

    const MODULE_NAME = 'biolinks';

    public static function addModuleSetting($company)
    {
        $roles = ['employee', 'admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);
    }

}
