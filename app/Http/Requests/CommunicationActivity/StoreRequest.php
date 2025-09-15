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
            // New fields
            'email' => 'nullable|email|max:255',
            'phone_number' => 'nullable|string|max:20',
            'instagram_username' => 'nullable|string|max:255',
            'telegram_username' => 'nullable|string|max:255',
            'first_name' => 'nullable|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'subject' => 'nullable|string|max:255',
            'message_type' => 'nullable|in:text,image,video,audio,file',
            'files' => 'nullable|array',
            // only file url is required, file_type and file_size can be nullable
            'files.*.file_url' => 'required_with:files|string|max:2048',
            'files.*.file_type' => 'nullable|string|max:255',
            'files.*.file_size' => 'nullable|integer|min:1',

        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        // TODO: use lang files for these messages, not hardcoded strings
        return [
            'deal_id.exists' => 'The selected deal does not exist.',
            'lead_id.exists' => 'The selected lead does not exist.',
            'channel_type.in' => 'The channel type must be one of: email, whatsapp, instagram, telegram.',
            'message_type.in' => 'The message type must be one of: text, image, video, audio, file.',
            'sender_info.required' => 'Sender information is required.',
            'sender_info.name.required' => 'Sender name is required.',
            'sender_info.contact.required' => 'Sender contact is required.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    // public function withValidator($validator)
    // {
    //     $validator->after(function ($validator) {
    //         // Ensure either deal_id or lead_id is provided, but not both
    //         if (empty($this->deal_id) && empty($this->lead_id)) {
    //             $validator->errors()->add('deal_id', 'Either deal_id or lead_id must be provided.');
    //         }

    //         if (!empty($this->deal_id) && !empty($this->lead_id)) {
    //             $validator->errors()->add('deal_id', 'Cannot provide both deal_id and lead_id.');
    //         }
    //     });
    // }
} 