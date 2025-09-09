<?php

namespace Modules\Payroll\Http\Requests\OvertimeRequest;

use Illuminate\Foundation\Http\FormRequest;

class StoreRequest extends FormRequest
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
            'employee' => 'required',
            'date.*' => 'required|date_format:"' . $setting->date_format,
            'overtime_hours.*' => 'required|numeric',

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

    public function messages()
    {
        $messages = [ ];

        $dates = $this->date;

        foreach($dates as $key => $date)
        {
            $dKey = 'date.'.$key;
            $ohKey = 'overtime_hours.'.$key;

            $messages[$dKey] = __('payroll::messages.dateFieldRequired');
            $messages[$ohKey] = __('payroll::messages.overtimeHourFieldRequired');
        }

        return $messages;

    }

}
