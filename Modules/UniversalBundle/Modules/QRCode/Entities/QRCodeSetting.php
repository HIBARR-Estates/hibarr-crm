<?php

namespace Modules\QRCode\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;

class QRCodeSetting extends BaseModel
{

    protected $table = 'qr_code_settings';

    protected $guarded = ['id'];

    const MODULE_NAME = 'qrcode';

    public static function addModuleSetting($company)
    {
        $roles = ['employee', 'admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);
    }

}
