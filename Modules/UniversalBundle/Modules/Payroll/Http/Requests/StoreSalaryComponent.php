<?php

namespace Modules\Payroll\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSalaryComponent extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            'component_name' => 'required',
            'component_type' => 'required',
            'component_value' => 'required|numeric|min:0',
            'weekly_value' => 'required|numeric|min:0',
            'biweekly_value' => 'required|numeric|min:0',
            'semimonthly_value' => 'required|numeric|min:0',
            'value_type' => 'required',
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
