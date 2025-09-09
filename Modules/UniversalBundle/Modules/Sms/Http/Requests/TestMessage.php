<?php

namespace Modules\Sms\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TestMessage extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {

        $rules = [];

        if (sms_setting()->telegram_status) {
            $rules['telegram_user_id'] = 'required|integer';
        }
        else {
            $rules['mobile'] = 'required|integer';
        }

        return $rules;

    }

    public function attributes()
    {
        return [
            'telegram_user_id' => __('sms::modules.telegramUserId'),
        ];
    }

}
