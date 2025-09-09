<?php

namespace Modules\Sms\Http\Traits;

use Illuminate\Support\Facades\Config;

trait SmsSettingTrait
{

    public function setConfig()
    {
        $smsSettings = \Modules\Sms\Entities\SmsSetting::first();
        if ($smsSettings) {
            Config::set('twilio-notification-channel.auth_token', $smsSettings->auth_token);
            Config::set('twilio-notification-channel.account_sid', $smsSettings->account_sid);
            Config::set('twilio-notification-channel.from', $smsSettings->from_number);

            Config::set('vonage.api_key', $smsSettings->nexmo_api_key);
            Config::set('vonage.api_secret', $smsSettings->nexmo_api_secret);
            Config::set('vonage.sms_from', $smsSettings->nexmo_from_number);

            Config::set('services.msg91.key', $smsSettings->msg91_auth_key);
            Config::set('services.msg91.msg91_from', $smsSettings->msg91_from);

            Config::set('services.telegram-bot-api.token', $smsSettings->telegram_bot_token);
        }
        (new \Illuminate\Notifications\VonageChannelServiceProvider(app()))->register();
    }

}
