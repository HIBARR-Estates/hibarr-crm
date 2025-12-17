<?php

namespace App\Http\Requests\Deal;

use App\Http\Requests\CoreRequest;

class CreateDealRequest extends CoreRequest
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
            
            // Optional deal fields
            'package_id' => 'nullable|integer|exists:packages,id',
            'pipeline_id' => 'nullable|integer|exists:lead_pipelines,id',
            'pipeline_stage_id' => 'nullable|integer|exists:pipeline_stages,id',
            'deal_owner_id' => 'nullable|integer|exists:users,id',
            'deal_watcher' => 'nullable|array',
            'deal_watcher.*' => 'integer|exists:users,id',
            
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
            
            // Optional Hibarr custom fields
            'customerBudget' => 'nullable|string|max:255',
            'motivation' => 'nullable|string',
            
            // Optional meeting object
            'meeting' => 'nullable|array',
            'meeting.meeting_date' => 'nullable|date',
            'meeting.meeting_type' => 'nullable|string|max:255',
            'meeting.meeting_location' => 'nullable|string|max:255',
            'meeting.meeting_link' => 'nullable|url|max:500',
            'meeting.meeting_id' => 'nullable|string|max:255',
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
            'package_id.exists' => 'The selected package does not exist.',
            'pipeline_id.exists' => 'The selected pipeline does not exist.',
            'pipeline_stage_id.exists' => 'The selected pipeline stage does not exist.',
            'deal_owner_id.exists' => 'The selected deal owner does not exist.',
            'deal_watcher.*.exists' => 'One or more selected deal watchers do not exist.',
            'meeting.meeting_link.url' => 'The meeting link must be a valid URL.',
        ];
    }
}

