<?php

namespace Modules\Payroll\Http\Requests\OvertimeSetting\Policy;

use Illuminate\Foundation\Http\FormRequest;

class PolicyStoreRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */

    public function rules()
    {

        $rules = [
            'name' => 'required | unique:overtime_policies,name, null,id,company_id,' . company()->id,
        ];

        if(!$this->has('working_days') && !$this->has('week_end') && !$this->has('holiday'))
        {
            $rules['working_days'] = 'required';
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
