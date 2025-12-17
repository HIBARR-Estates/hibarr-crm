<?php

namespace App\Http\Requests\Contact;

use App\Http\Requests\CoreRequest;

class CreateOrUpdateContactRequest extends CoreRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true; // Authorization handled by middleware
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        return [
            // Required contact fields
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'gender' => 'nullable|string|in:male,female',
            
            // Optional contact fields
            'phone' => 'nullable|string|max:50',
            'lead_source_id' => 'nullable|integer|exists:lead_sources,id',
            'lead_owner_id' => 'nullable|integer|exists:users,id',
            
            // Optional UTM/marketing fields
            'utmInfo' => 'nullable|array',
            'utmInfo.source' => 'nullable|string|max:255',
            'utmInfo.medium' => 'nullable|string|max:255',
            'utmInfo.campaign' => 'nullable|string|max:255',
            'utmInfo.term' => 'nullable|string|max:255',
            'utmInfo.content' => 'nullable|string|max:255',
            'facebook_click_id' => 'nullable|string|max:255',
            'facebook_lead_id' => 'nullable|string|max:255',
            
            // Optional engagement tracking fields
            'has_registered_for_the_webinar' => 'nullable|boolean',
            'has_joined_the_facebook_group' => 'nullable|boolean',
            'has_downloaded_the_ebook' => 'nullable|boolean',
            'has_attended_the_webinar' => 'nullable|boolean',
            'registered_for_zoom_meeting' => 'nullable|boolean',
            'last_webinar_date' => 'nullable|date',
            'contact_score' => 'nullable|integer|min:0',
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
            'name.required' => 'The contact name is required.',
            'email.required' => 'The contact email is required.',
            'email.email' => 'The contact email must be a valid email address.',
            'lead_source_id.exists' => 'The selected lead source does not exist.',
            'lead_source_id.integer' => 'The lead source ID must be a valid integer.',
        ];
    }
}

