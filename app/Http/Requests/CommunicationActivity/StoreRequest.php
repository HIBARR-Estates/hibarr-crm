<?php

namespace App\Http\Requests\CommunicationActivity;

use Illuminate\Foundation\Http\FormRequest;


// TODO: use lang files for these messages, not hardcoded strings

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
            'chat_id' => 'nullable|string|max:255', 
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
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $channel = $this->input('channel_type');

            // Email channel → email must be present
            if ($channel === 'email' ) {
                if(empty($this->input('email'))){
                    $validator->errors()->add('email', 'An email address is required when the channel type is email.');
                }
                // ensure that the following fields are not present, to enforce the unique channel identifier constraint
                // telegram_username, instagram_username, phone_number
                if(!empty($this->input('telegram_username'))){
                    $validator->errors()->add('telegram_username', 'Telegram username should not be provided when the channel type is email.');
                }
                if(!empty($this->input('instagram_username'))){
                    $validator->errors()->add('instagram_username', 'Instagram username should not be provided when the channel type is email.');
                }
                if(!empty($this->input('phone_number'))){
                    $validator->errors()->add('phone_number', 'Phone number should not be provided when the channel type is email.');
                }
            }
            // Telegram channel → telegram_username or phone_number must be present
            if ($channel === 'telegram') {
                if(empty($this->input('telegram_username'))) {
                    $validator->errors()->add('telegram_username', 'A telegram username is required when the channel type is telegram.');
                }
                if(empty($this->input('chat_id'))) {
                    $validator->errors()->add('chat_id', 'A chat ID is required when the channel type is telegram.');
                }
                // ensure that the following fields are not present, to enforce the unique channel identifier constraint
                // email, instagram_username, phone_number
                if(!empty($this->input('email'))){
                    $validator->errors()->add('email', 'Email should not be provided when the channel type is telegram.');
                }
                if(!empty($this->input('instagram_username'))){
                    $validator->errors()->add('instagram_username', 'Instagram username should not be provided when the channel type is telegram.');
                }
                if(!empty($this->input('phone_number'))){
                    $validator->errors()->add('phone_number', 'Phone number should not be provided when the channel type is telegram.');
                }
            }

            // WhatsApp channel → phone_number must be present
            if ($channel === 'whatsapp' ) {
                if(empty($this->input('whatsapp_username'))){
                    $validator->errors()->add('whatsapp_username', 'A WhatsApp username is required when the channel type is whatsapp, this is likely to be same value as phone number');
                }
                if(empty($this->input('phone_number'))){
                    $validator->errors()->add('phone_number', 'A phone number is required when the channel type is whatsapp.');
                }
                // ensure that the following fields are not present, to enforce the unique channel identifier constraint
                // telegram_username, instagram_username, email
                if(!empty($this->input('telegram_username'))){
                    $validator->errors()->add('telegram_username', 'Telegram username should not be provided when the channel type is whatsapp.');
                }
                if(!empty($this->input('instagram_username'))){
                    $validator->errors()->add('instagram_username', 'Instagram username should not be provided when the channel type is whatsapp.');
                }
                if(!empty($this->input('email'))){
                    $validator->errors()->add('email', 'Email should not be provided when the channel type is whatsapp.');
                }
            }

            // Instagram channel → instagram_username must be present
            if ($channel === 'instagram') {
                if(empty($this->input('instagram_username'))){
                    $validator->errors()->add('instagram_username', 'An Instagram username is required when the channel type is instagram.');
                }
                // ensure that the following fields are not present, to enforce the unique channel identifier constraint
                // telegram_username, email, phone_number
                if(!empty($this->input('telegram_username'))){
                    $validator->errors()->add('telegram_username', 'Telegram username should not be provided when the channel type is instagram.');
                }
                if(!empty($this->input('phone_number'))){
                    $validator->errors()->add('phone_number', 'Phone number should not be provided when the channel type is instagram.');
                }
                if(!empty($this->input('email'))){
                    $validator->errors()->add('email', 'Email should not be provided when the channel type is instagram.');
                }

            }


            // If message_type is "file" then files array must be present
            if ($this->input('message_type') === 'file' && empty($this->input('files'))) {
                $validator->errors()->add('files', 'Files are required when message_type is set to file.');
                // Ensure that only of them is present at a time and not all - telegram_username, instagram_username, phone_number, email
                $valuesNet = ([
                    $this->input('telegram_username'),
                    $this->input('instagram_username'),
                    $this->input('phone_number'),
                    $this->input('email'),
                ]);
                // go through and ensure just one item is present
                $nonEmptyCount = 0;
                foreach ($valuesNet as $value) {
                    if (!empty($value)) {
                        $nonEmptyCount++;
                    }
                }
                if ($nonEmptyCount > 1) {
                    $validator->errors()->add('channel_type', 'Only one unique channel identifier should be provided among telegram_username, instagram_username, phone_number, or email.');
                }

                
            }
        });
    }
} 