<?php

namespace Modules\Zoom\Http\Requests\ZoomMeeting;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSetting extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'account_id' => 'required',
            'api_key' => 'required',
            'secret_key' => 'required',
            'secret_token' => 'required',
            'meeting_client_id' => 'required',
            'meeting_client_secret' => 'required',
        ];
    }

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }
}
