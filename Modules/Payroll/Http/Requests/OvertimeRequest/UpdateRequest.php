<?php

namespace Modules\Payroll\Http\Requests\OvertimeRequest;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $setting = company();

        return [
            'user_id' => 'required',
            'date' => 'required|date_format:"' . $setting->date_format,
            'overtime_hours' => 'required',

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
