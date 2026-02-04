<?php

namespace App\Http\Requests;

use App\Models\UserReminderPreference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserReminderPreferenceRequest extends FormRequest
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
     * @return array<string, mixed>
     */
    public function rules()
    {
        return [
            'entity_type' => [
                'required',
                Rule::in(UserReminderPreference::ENTITY_TYPES),
            ],
            'reminders' => 'required|array|min:1|max:20',
            'reminders.*.time' => 'required|integer|min:0|max:10080', // Max 7 days in minutes
            'reminders.*.type' => [
                'required',
                Rule::in(['minute', 'hour', 'day']),
            ],
            'is_active' => 'boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages()
    {
        return [
            'entity_type.required' => __('messages.entityTypeRequired'),
            'entity_type.in' => __('messages.invalidEntityType'),
            'reminders.required' => __('messages.atLeastOneReminder'),
            'reminders.min' => __('messages.atLeastOneReminder'),
            'reminders.max' => __('messages.tooManyReminders'),
            'reminders.*.time.required' => __('messages.reminderTimeRequired'),
            'reminders.*.time.integer' => __('messages.reminderTimeMustBeNumber'),
            'reminders.*.time.min' => __('messages.reminderTimeMin'),
            'reminders.*.time.max' => __('messages.reminderTimeMax'),
            'reminders.*.type.required' => __('messages.reminderTypeRequired'),
            'reminders.*.type.in' => __('messages.invalidReminderType'),
        ];
    }
}
