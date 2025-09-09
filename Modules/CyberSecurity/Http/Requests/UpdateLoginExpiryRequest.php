<?php

namespace Modules\CyberSecurity\Http\Requests;

use Illuminate\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLoginExpiryRequest extends FormRequest
{

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

        /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'user_id' => [
                'required',
                'integer',
                Rule::unique('login_expiries')->ignore($this->route('login_expiry')),
            ],
            'expiry_date' => ['required', 'date'],
        ];
    }

}
