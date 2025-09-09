<?php

namespace Modules\Payroll\Http\Requests\OvertimeSetting\Paycode;

use Illuminate\Foundation\Http\FormRequest;

class PayCodeUpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */

    public function rules()
    {
        $rules = [
            'name' => 'required | unique:pay_codes,name,' . $this->route('pay_code') .',id,company_id,' . company()->id,
            'code' => 'required | unique:pay_codes,code,' . $this->route('pay_code') .',id,company_id,' . company()->id,
        ];

        if($this->has('rate_type') && $this->rate_type == 'time'){
            $rules['regular_time_rate'] = 'required';
            $rules['holiday_time_rate'] = 'required';
            $rules['day_off_time_rate'] = 'required';
        }
        else{
            $rules['regular_fixed_amount'] = 'required';
            $rules['holiday_fixed_amount'] = 'required';
            $rules['day_off_fixed_amount'] = 'required';
        }

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
