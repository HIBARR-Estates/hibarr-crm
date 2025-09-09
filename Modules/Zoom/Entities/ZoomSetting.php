<?php

namespace Modules\Zoom\Entities;

use App\Models\BaseModel;
use App\Models\ModuleSetting;
use App\Scopes\CompanyScope;
use App\Traits\HasCompany;
use Illuminate\Support\Facades\Schema;
use Nwidart\Modules\Facades\Module;

class ZoomSetting extends BaseModel
{

    use HasCompany;

    protected $table = 'zoom_setting';

    const MODULE_NAME = 'zoom';

    protected $fillable = ['api_key', 'secret_key', 'meeting_app', 'secret_token', 'account_id', 'meeting_client_id', 'meeting_client_secret'];

    public static function addModuleSetting($company)
    {
        // create admin, employee and client module settings
        $roles = ['admin', 'employee', 'client'];

        ModuleSetting::createRoleSettingEntry(self::MODULE_NAME, $roles, $company);

        $setting = ZoomSetting::withoutGlobalScope(CompanyScope::class)->where('company_id', $company->id)->first();

        if (!$setting) {
            $newSetting = new ZoomSetting;
            $newSetting->company_id = $company->id;
            $newSetting->saveQuietly();
        }

        if (Schema::hasTable('zoom_notification_settings')) {
            $settingZoom = ZoomNotificationSetting::where('company_id', $company->id)->exists();

            if (!$settingZoom) {
                $settings = [
                    [
                        'company_id' => $company->id,
                        'setting_name' => 'Zoom Meeting Created',
                        'send_email' => 'no',
                        'send_slack' => 'no',
                        'slug' => 'zoom-meeting-created',
                    ],
                ];

                ZoomNotificationSetting::insert($settings);
            }
        }

    }

}
