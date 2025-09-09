<?php

namespace Modules\Sms\Http\Traits;

use Modules\Sms\Entities\SmsTemplateId;

trait WhatsappMessageTrait
{
    public function toWhatsapp($slug, $notifiable, $message, $data = [])
    {
        foreach ($data as $key => $value) {
            if (!is_string($value)) {
                $data[$key] = strval($value);
            }
        }
        $settings = sms_setting();
        $this->smsTemplateId = SmsTemplateId::where('sms_setting_slug', $slug)->first();

        if (! $settings->whatsapp_status) {
            return true;
        }

        $toNumber = '+'.$notifiable->country_phonecode.$notifiable->mobile;
        $fromNumber = $settings->whatapp_from_number;

        $twilio = new \Twilio\Rest\Client($settings->account_sid, $settings->auth_token);

        $message = $twilio->messages
            ->create(
                'whatsapp:'.$toNumber, // to
                [
                    'from' => 'whatsapp:'.$fromNumber,
                    'body' => $message,
                    'contentSid' => $this->smsTemplateId->whatsapp_template_sid,
                    'ContentVariables' => json_encode($data),
                ]
            );
    }
}
