<?php

namespace Modules\QRCode\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\QRCode\Enums\Type;

class QrPreview extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $rules = [
            'type' => [
                'required',
                'string',
                Rule::in(Type::toArray()),
            ],
            'size' => 'required|numeric|min:200',
            'margin' => 'required|numeric',
            'qrTitle' => 'required|string',
            'background_color'=> 'required',
            'foreground_color'=> 'required'
        ];

        $rules = match (Type::tryFrom($this->type)) {
            Type::email => $this->qrEmail($rules),
            Type::event => $this->qrEvent($rules),
            Type::geo => $this->qrGeo($rules),
            Type::paypal => $this->qrPaypal($rules),
            Type::skype => $this->qrSkype($rules),
            Type::sms => $this->qrSms($rules),
            Type::tel => $this->qrTel($rules),
            Type::text => $this->qrText($rules),
            Type::upi => $this->qrUpi($rules),
            Type::url => $this->qrUrl($rules),
            Type::whatsapp => $this->qrSms($rules),
            Type::wifi => $this->qrWifi($rules),
            Type::zoom => $this->qrUrl($rules),
            default => $rules,
        };

        return $rules;
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function messages()
    {
        return [
            'end_time.after_or_equal' => __('messages.endTimeAfterOrEqual'),
        ];
    }

    private function qrText($rules)
    {
        $rules['message'] = 'required|string';
        return $rules;
    }

    private function qrEmail($rules)
    {
        $rules['email'] = 'required|email';
        $rules['subject'] = 'nullable|string';
        $rules['message'] = 'nullable|string';
        return $rules;
    }

    private function qrEvent($rules)
    {
        $setting = company();

        $rules['title'] = 'required|string';
        $rules['location'] = 'nullable|string';
        $rules['start_date'] = 'required|date_format:"' . $setting->date_format . '"';
        $rules['start_time'] = 'required';
        $rules['end_date'] = 'required|date_format:"' . $setting->date_format . '"|after_or_equal:start_date';
        $rules['end_time'] = 'required|after_or_equal:start_time';
        $rules['reminder'] = 'nullable';
        $rules['link'] = 'nullable|url';
        $rules['note'] = 'nullable|string';
        return $rules;
    }

    private function qrGeo($rules)
    {
        $rules['latitude'] = 'required|numeric';
        $rules['longitude'] = 'required|numeric';
        return $rules;
    }

    private function qrPaypal($rules)
    {
        $rules['paymentType'] = 'required|string';
        $rules['currency'] = 'required|string';
        $rules['itemName'] = 'required|string';
        $rules['itemId'] = 'nullable|string';
        $rules['email'] = 'required|email';
        $rules['amount'] = 'nullable|numeric';
        $rules['shipping'] = 'nullable|numeric';
        $rules['tax'] = 'nullable|numeric';
        return $rules;
    }

    private function qrSkype($rules)
    {
        $rules['username'] = 'required|string';
        $rules['skypeContactType'] = 'required|string';
        return $rules;
    }

    private function qrSms($rules)
    {
        $rules = $this->qrTel($rules);
        $rules['message'] = 'nullable|string';
        return $rules;
    }

    private function qrTel($rules)
    {
        $rules['mobile'] = 'required|numeric';
        $rules['country_phonecode'] = 'required|numeric';
        return $rules;
    }

    private function qrUrl($rules)
    {
        $rules['url'] = 'required|url';
        return $rules;
    }

    private function qrUpi($rules)
    {
        $rules['name'] = 'nullable|string';
        $rules['upi'] = 'required|string';
        $rules['amount'] = 'nullable|numeric';
        $rules['description'] = 'nullable|string';
        return $rules;
    }

    private function qrWifi($rules)
    {
        $rules['name'] = 'required|string';
        $rules['password'] = 'nullable|string';
        $rules['encryption'] = 'nullable|string';
        $rules['hidden'] = 'nullable|boolean';
        return $rules;
    }

}
