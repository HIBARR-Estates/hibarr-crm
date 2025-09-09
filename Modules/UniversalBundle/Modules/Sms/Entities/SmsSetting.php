<?php

namespace Modules\Sms\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;
use App\Scopes\CompanyScope;
use Modules\Sms\Enums\SmsNotificationSlug;

class SmsSetting extends BaseModel
{
    protected $guarded = ['id'];

    const MODULE_NAME = 'sms';

    public static function addModuleSetting($company)
    {
        $roles = ['admin'];
        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);

        self::notifications($company);
    }

    private static function notifications($company)
    {
        if (isWorksuite())
        {
            SmsNotificationSetting::where('slug', 'test-sms-notification')->update(['company_id' => $company->id]);
        }

        foreach (SmsNotificationSlug::cases() as $slug) {

            if ($slug->value == 'test-sms-notification') {
                continue;
            }

            $setting = SmsNotificationSetting::withoutGlobalScope(CompanyScope::class)->firstOrNew([
                'company_id' => $company->id,
                'setting_name' => $slug->label(),
                'slug' => $slug->value,
                'send_sms' => 'no',
            ]);

            $setting->saveQuietly();

            SmsTemplateId::firstOrNew([
                'sms_setting_slug' => $slug->value,
            ])->saveQuietly();

        }

    }

}
