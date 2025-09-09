<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AgendaRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        if (request()->send_mail == 'no') {
            return ['discussion_point' => 'required'];
        }
        else {
            return [
                'discussion_points' => 'required|array',
                'discussion_points.*' => 'required|string',
            ];
        }
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function messages()
    {
        return [
            'discussion_points.required' => __('performance::messages.discussionPointsRequired'),
            'discussion_points.array' => __('performance::messages.discussionPointsArray'),
            'discussion_points.*.required' => __('performance::messages.individualDiscussionPointRequired'),
            'discussion_points.*.string' => __('performance::messages.discussionPointMustBeString'),
        ];
    }

}
