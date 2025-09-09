<?php

namespace Modules\Performance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateObjectiveRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $id = request()->objective_id;

        return [
            'title' => [
                'required',
                'unique:objectives,title,'.$id.',id,company_id,' . company()->id,
            ],
            'description' => 'required',
            'goal_type' => 'required|integer|exists:goal_types,id',
            'department_id' => 'nullable|integer|exists:teams,id',
            'start_date' => 'required|date_format:"' . company()->date_format . '"',
            'end_date' => 'required|date_format:"' . company()->date_format . '"|after_or_equal:start_date',
            'priority' => 'required|in:low,medium,high',
            'check_in_frequency' => 'required|in:daily,weekly,bi-weekly,monthly,quarterly',
            'schedule_on' => 'required_if:check_in_frequency,weekly,bi-weekly',
            'rotation_date' => 'required_if:check_in_frequency,monthly,quarterly',
            'owner_id.0' => 'required|integer|exists:users,id',
        ];
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
            'owner_id.0.required' => __('performance::messages.atleastOneValidation')
        ];
    }

}
