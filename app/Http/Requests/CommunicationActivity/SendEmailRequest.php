<?php

namespace App\Http\Requests\CommunicationActivity;

use App\Http\Requests\CoreRequest;

class SendEmailRequest extends CoreRequest
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
            'deal_id' => 'nullable|integer|exists:deals,id|required_without:lead_id',
            'lead_id' => 'nullable|integer|exists:leads,id|required_without:deal_id',
            'activity_id' => 'nullable|integer|exists:communication_activities,id',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
            'template' => 'nullable|string|max:255',
            'template_data' => 'nullable|array',
            'sender_id' => 'nullable|integer|exists:users,id',
            'sender_email' => 'nullable|email|exists:users,email',
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
            'deal_id.exists' => 'The selected deal does not exist.',
            'lead_id.exists' => 'The selected lead does not exist.',
            'activity_id.exists' => 'The selected communication activity does not exist.',
            'subject.required' => 'Email subject is required.',
            'message.required' => 'Email message is required.',
        ];
    }
}

