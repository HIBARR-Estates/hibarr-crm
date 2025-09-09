<?php

namespace Modules\CyberSecurity\Http\Requests;

use Illuminate\Validation\Rule;
use Illuminate\Foundation\Http\FormRequest;

class StoreLoginExpiryRequest extends FormRequest
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
                Rule::unique('login_expiries', 'user_id'),
                'integer'
            ],
            'expiry_date' => ['required', 'date'],
        ];
    }

}
