<?php

namespace Modules\Zoom\Http\Requests\ZoomMeeting;

use Froiden\LaravelInstaller\Request\CoreRequest;

class UpdateOccurrence extends CoreRequest
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
        $setting = company();

        return [
            'start_date' => 'required',
            'end_date' => 'required|date_format:"'.$setting->date_format.'"|after_or_equal:start_date',
        ];
    }
}
