<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMeeting extends FormRequest
{

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'meeting_date' => 'required|date',
            'start_time' => 'required',
            'end_time' => 'required|after:start_time',
            'meeting_for' => 'exists:users,id',
            'meeting_by' => 'exists:users,id'
        ];
    }

    public function messages()
    {
        return [
            'end_time.required' => __('performance::messages.endTime'),
        ];
    }

}
