<?php

namespace Modules\Webhooks\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;

class WebhooksGlobalSetting extends BaseModel
{

    protected $guarded = ['id'];

    const MODULE_NAME = 'webhooks';

    public static function addModuleSetting($company)
    {
        $roles = ['employee', 'admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);
    }

}

