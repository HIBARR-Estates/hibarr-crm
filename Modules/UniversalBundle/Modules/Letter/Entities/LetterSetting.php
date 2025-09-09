<?php

namespace Modules\Letter\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;

class LetterSetting extends BaseModel
{

    protected $guarded = ['id'];

    const MODULE_NAME = 'letter';

    public static function addModuleSetting($company)
    {
        $roles = ['employee', 'admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);
    }

}

