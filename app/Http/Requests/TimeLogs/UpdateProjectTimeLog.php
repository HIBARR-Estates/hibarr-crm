<?php

namespace App\Http\Requests\TimeLogs;

use App\Http\Requests\CoreRequest;

class UpdateProjectTimeLog extends CoreRequest
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
            'reason' => 'required|string|max:255'
        ];
    }

}
