<?php

namespace Modules\Zoom\Http\Requests\ZoomMeeting;

use Froiden\LaravelInstaller\Request\CoreRequest;

class StoreMeetingNote extends CoreRequest
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
            'note' => [
                'required',
                function ($attribute, $value, $fail) {
                    $comment = trim_editor($value);

                    if ($comment == '') {
                        $fail(__('validation.required'));
                    }
                },
            ],
        ];
    }

    public function messages()
    {
        return [
            'employee_id.0.required_without_all' => __('zoom::modules.zoommeeting.attendeeValidation'),
            'client_id.0.required_without_all' => __('zoom::modules.zoommeeting.attendeeValidation'),
        ];
    }
}
