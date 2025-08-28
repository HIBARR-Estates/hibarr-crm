<?php

namespace App\Http\Requests\CommunicationActivity;

use Illuminate\Foundation\Http\FormRequest;

class StoreRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'deal_id' => 'nullable|exists:deals,id',
            'lead_id' => 'nullable|exists:leads,id',
            'channel_type' => 'required|in:email,whatsapp,instagram,telegram',
            'message_content' => 'required|string|max:10000',
            'sender_info' => 'required|array',
            'sender_info.name' => 'required|string|max:255',
            'sender_info.contact' => 'required|string|max:255',
            'timestamp' => 'required|date',
            'metadata' => 'nullable|array',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'deal_id.exists' => 'The selected deal does not exist.',
            'lead_id.exists' => 'The selected lead does not exist.',
            'channel_type.in' => 'The channel type must be one of: email, whatsapp, instagram, telegram.',
            'sender_info.required' => 'Sender information is required.',
            'sender_info.name.required' => 'Sender name is required.',
            'sender_info.contact.required' => 'Sender contact is required.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Ensure either deal_id or lead_id is provided, but not both
            if (empty($this->deal_id) && empty($this->lead_id)) {
                $validator->errors()->add('deal_id', 'Either deal_id or lead_id must be provided.');
            }

            if (!empty($this->deal_id) && !empty($this->lead_id)) {
                $validator->errors()->add('deal_id', 'Cannot provide both deal_id and lead_id.');
            }
        });
    }
} 