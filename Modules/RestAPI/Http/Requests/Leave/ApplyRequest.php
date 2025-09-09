<?php

namespace Modules\RestAPI\Http\Requests\Leave;

use Modules\RestAPI\Http\Requests\BaseRequest;

class ApplyRequest extends BaseRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'leave_type_id' => 'required|exists:leave_types,id',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'required|string',
            'half_day' => 'boolean',
            'status' => 'in:pending,approved,rejected'
        ];
    }
}
