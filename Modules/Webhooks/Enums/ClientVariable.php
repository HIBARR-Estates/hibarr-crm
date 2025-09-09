<?php

namespace Modules\Webhooks\Enums;

use Modules\Webhooks\Enums\Variable;

enum ClientVariable: string implements Variable
{

    case name = '##NAME##';
    case email = '##EMAIL##';
    case mobile = '##MOBILE##';
    case country_phonecode = '##COUNTRY_PHONECODE##';
    case mobile_with_phonecode = '##MOBILE_WITH_PHONECODE##';
    case gender = '##GENDER##';
    case website = '##WEBSITE##';
    case address = '##ADDRESS##';
    case shipping_address = '##SHIPPING_ADDRESS##';
    case company_name = '##COMPANY_NAME##';
    case gst_number = '##GST_NUMBER##';
    case office = '##OFFICE##';
    case city = '##CITY##';
    case state = '##STATE##';
    case postal_code = '##POSTAL_CODE##';

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
            'two_factor_secret',
            'two_factor_recovery_codes',
            'last_updated_by',
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
            'stripe_id'
        ];
    }

}
