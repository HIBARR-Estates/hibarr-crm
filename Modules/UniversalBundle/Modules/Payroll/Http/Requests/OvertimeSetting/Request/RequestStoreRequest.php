<?php

namespace Modules\Payroll\Http\Requests\OvertimeSetting\Request;

use Illuminate\Foundation\Http\FormRequest;

class PayCodeStoreRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */

    public function rules()
    {
        $setting = company();

        $rules = [
           'start_date' => 'required|date_format:"' . $setting->date_format . '"',
           'end_date' => 'required|date_format:"' . $setting->date_format . '"|after_or_equal:start_date'
        ];

        return $rules;

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
