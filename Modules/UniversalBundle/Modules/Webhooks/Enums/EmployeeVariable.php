<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum EmployeeVariable: string implements Variable
{
    case name = '##NAME##';
    case email = '##EMAIL##';
    case mobile = '##MOBILE##';
    case country_phonecode = '##COUNTRY_PHONECODE##';
    case mobile_with_phonecode = '##MOBILE_WITH_PHONECODE##';
    case gender = '##GENDER##';
    case address = '##ADDRESS##';
    case hourly_rate = '##HOURLY_RATE##';
    case slack_username = '##SLACK_USERNAME##';
    case about_me = '##ABOUT_ME##';
    case marital_status = '##MARITAL_STATUS##';
    case employment_type = '##EMPLOYMENT_TYPE##';

    public function key(): string
    {
        return match ($this) {
            default => $this->name,
        };
    }

    public static function invalidVariables(): array
    {
        return [
            'id',
            'company_id',
            'last_updated_by',
            'added_by',
            'modules',
            'user_id',
            'user',
            'company',
            'two_factor_confirmed',
            'two_factor_email_confirmed',
            'country_id',
            'dark_theme',
            'rtl',
            'admin_approval',
            'permission_sync',
            'google_calendar_status',
            'customised_permissions',
            'email_notifications',
        ];
    }

}
