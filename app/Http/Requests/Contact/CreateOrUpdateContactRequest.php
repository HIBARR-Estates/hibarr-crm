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
            'lead_category_id' => 'nullable|integer|exists:lead_category,id',
            'update_agent_if_exists' => 'nullable|boolean',
            'notify' => 'nullable|boolean',
            
            // Optional UTM/marketing fields
            'utmInfo' => 'nullable|array',
            'utmInfo.source' => 'nullable|string|max:255',
            'utmInfo.medium' => 'nullable|string|max:255',
            'utmInfo.campaign' => 'nullable|string|max:255',
            'utmInfo.term' => 'nullable|string|max:255',
            'utmInfo.content' => 'nullable|string|max:255',
            'facebook_click_id' => 'nullable|string|max:255',
            'facebook_lead_id' => 'nullable|string|max:255',
            'facebook_browser_id' => 'nullable|string|max:255',
            'user_agent' => 'nullable|string|max:1024',
            'ip_address' => 'nullable|string|max:45',

            // Optional engagement tracking fields
            'has_registered_for_the_webinar' => 'nullable|boolean',
            'has_joined_the_facebook_group' => 'nullable|boolean',
            'has_downloaded_the_ebook' => 'nullable|boolean',
            'has_attended_the_webinar' => 'nullable|boolean',
            'registered_for_zoom_meeting' => 'nullable|boolean',
            'last_webinar_date' => 'nullable|date',
            'contact_score' => 'nullable|integer|min:0',

            // Optional Lead Contact fields
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:255',
            'date_of_birth' => 'nullable|date',

            // Optional classification / engagement (CRM lead fields)
            'temperature' => 'nullable|string|in:cold,warm,hot',
            'lead_lifecycle_status_id' => 'nullable|integer|exists:lead_lifecycle_statuses,id',
            'has_joined_the_whatsapp_group' => 'nullable|boolean',

            // Optional lead custom fields: {"131": "value", "132": ["a","b"]}
            // Also accepts `custom_fields` as an alias on this contact-only endpoint.
            'lead_custom_fields' => 'nullable|array',
            'lead_custom_fields.*' => 'nullable',
            'custom_fields' => 'nullable|array',
            'custom_fields.*' => 'nullable',
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

