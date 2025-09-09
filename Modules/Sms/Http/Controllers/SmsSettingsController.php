<?php

namespace Modules\Sms\Http\Controllers;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\Country;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Entities\SmsNotificationSetting;
use Modules\Sms\Entities\SmsSetting;
use Modules\Sms\Http\Requests\StoreSmsSetting;
use Modules\Sms\Notifications\TestMessage;
use Modules\Sms\Entities\SmsTemplateId;

class SmsSettingsController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'SMS '.__('app.menu.settings');
        $this->activeSettingMenu = 'sms_setting';
        $this->middleware(function ($request, $next) {
            abort_403(! in_array(SmsSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     *
     * @return Response
     */
    public function index()
    {
        $this->smsSetting = sms_setting();
        $this->countries = countries();
        $this->smsSettings = SmsNotificationSetting::get();

        $this->whatsappSettings = SmsTemplateId::get();

        return view('sms::sms.index', $this->data);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  Request  $request
     * @param  int  $id
     * @return Response
     */
    //phpcs:ignore
    public function update(StoreSmsSetting $request, $id)
    {
        $smsSetting = SmsSetting::first();

        $smsSetting->status = 0;
        $smsSetting->whatsapp_status = 0;
        $smsSetting->nexmo_status = 0;
        $smsSetting->msg91_status = 0;
        $smsSetting->telegram_status = 0;

        if ($request->active_gateway == 'twilio') {
            $smsSetting->account_sid = $request->account_sid;
            $smsSetting->auth_token = $request->auth_token;
            $smsSetting->from_number = $request->from_number;
            $smsSetting->whatapp_from_number = $request->whatapp_from_number;
            $smsSetting->status = 1;
            $smsSetting->whatsapp_status = $request->whatsapp_status;
            if ($request->whatsapp_status) {
                foreach ($request->whatsapp_template_sid as $key => $templateSid) {
                    SmsTemplateId::where('sms_setting_slug', $key)->update(['whatsapp_template_sid' => $templateSid]);
                }
            }
        }

        if ($request->active_gateway == 'nexmo') {
            $smsSetting->nexmo_api_key = $request->nexmo_api_key;
            $smsSetting->nexmo_api_secret = $request->nexmo_api_secret;
            $smsSetting->nexmo_from_number = $request->nexmo_from_number;
            $smsSetting->nexmo_status = 1;
        }

        if ($request->active_gateway == 'msg91') {
            $smsSetting->msg91_auth_key = $request->msg91_auth_key;
            $smsSetting->msg91_from = $request->msg91_from;
            $smsSetting->msg91_status = 1;

            if ($request->msg91_flow_id) {
                foreach ($request->msg91_flow_id as $key => $templateSid) {
                    SmsTemplateId::where('sms_setting_slug', $key)->update(['msg91_flow_id' => $templateSid]);
                }
            }
        }

        if ($request->active_gateway == 'telegram') {
            $smsSetting->telegram_status = 1;
            $smsSetting->telegram_bot_token = $request->telegram_bot_token;
            $smsSetting->telegram_bot_name = str($request->telegram_bot_name)->replace('@', '');
        }

        $smsSetting->save();
        session(['sms_setting' => SmsSetting::first()]);

        SmsNotificationSetting::whereNotNull('setting_name')->update(['send_sms' => 'no']);

        if ($request->has('send_sms')) {
            foreach ($request->send_sms as $smsSetting) {
                $setting = SmsNotificationSetting::findOrFail($smsSetting);
                $setting->send_sms = 'yes';
                $setting->save();
            }
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function testMessage()
    {
        $this->countries = countries();
        $this->smsSettings = sms_setting();

        return view('sms::sms.test-message', $this->data);
    }

    public function sendTestMessage(\Modules\Sms\Http\Requests\TestMessage $request)
    {
        $this->smsSettings = sms_setting();

        if (
            ! $this->smsSettings->status
            && ! $this->smsSettings->nexmo_status
            && ! $this->smsSettings->msg91_status
            && ! $this->smsSettings->telegram_status
        ) {
            return Reply::error(__('sms::modules.noGatewayEnabled'));
        }

        Config::set('twilio-notification-channel.auth_token', $this->smsSettings->auth_token);
        Config::set('twilio-notification-channel.account_sid', $this->smsSettings->account_sid);
        Config::set('twilio-notification-channel.from', $this->smsSettings->from_number);

        Config::set('vonage.api_key', $this->smsSettings->nexmo_api_key);
        Config::set('vonage.api_secret', $this->smsSettings->nexmo_api_secret);
        Config::set('vonage.sms_from', $this->smsSettings->nexmo_from_number);

        Config::set('services.msg91.key', $this->smsSettings->msg91_auth_key);
        Config::set('services.msg91.msg91_from', $this->smsSettings->msg91_from);

        Config::set('services.telegram-bot-api.token', $this->smsSettings->telegram_bot_token);

        $number = $request->phone_code.$request->mobile;
        $nexmoNumber = str_replace('+', '', $request->phone_code).$request->mobile;
        $msg91Number = str_replace('+', '', $request->phone_code).$request->mobile;

        if ($this->smsSettings->status) {
            Notification::route('twilio', $number)->notify(new TestMessage($request->toArray()));
        }

        if ($this->smsSettings->msg91_status) {
            Notification::route('msg91', $msg91Number)->notify(new TestMessage($request->toArray()));
        }

        if ($this->smsSettings->nexmo_status) {
            (new \Illuminate\Notifications\VonageChannelServiceProvider(app()))->register();
            Notification::route('vonage', $nexmoNumber)->notify(new TestMessage($request->toArray()));
        }

        if ($this->smsSettings->telegram_status) {
            User::find(user()->id)->notify(new TestMessage($request->toArray()));
        }

        return Reply::success('Test message sent successfully');
    }

    public function twilioLookUp($number)
    {
        $this->smsSettings = sms_setting();
        $sid = $this->smsSettings->account_sid;
        $token = $this->smsSettings->auth_token;
        $twilio = new \Twilio\Rest\Client($sid, $token);

        return $twilio->lookups->v1->phoneNumbers($number)->fetch();
    }

}
