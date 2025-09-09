<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Models\Company;
use Froiden\RestAPI\ApiResponse;
use Illuminate\Routing\Controller;

class AppController extends Controller
{
    public function app()
    {
        $setting = Company::first();

        $setting->makeHidden([
            'weather_key',
            'currency_converter_key',
            'google_recaptcha_key',
            'google_recaptcha_secret',
            'show_review_modal',
            'show_public_message',
            'supported_until',
            'currency_id',
            'system_update',
            'purchase_code',
            'google_recaptcha',
            'hide_cron_message',
            'company_phone',
            'rounded_theme',
            'google_map_key',
            'google_recaptcha_v2_secret_key',
            'google_recaptcha_v2_site_key',
            'google_recaptcha_v2_status',
            'google_recaptcha_v3_secret_key',
            'google_recaptcha_v3_site_key',
            'google_recaptcha_v3_status',
            'datatable_row_limit',
            'stripe_id',
            'currency_key_version',
            'employee_can_export_data',
            'card_brand',
            'card_last_four',
            'headers',
            'ticket_form_google_captcha',
            'show_new_webhook_alert',
            'pm_last_four',
            'pm_type',
            'location_details',
            'lead_form_google_captcha'
        ]);

        return ApiResponse::make('Application data fetched successfully', $setting->toArray());
    }
}
