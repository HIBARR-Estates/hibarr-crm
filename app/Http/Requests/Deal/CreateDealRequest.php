<?php

namespace App\Http\Requests\Deal;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

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
     * Prepare the data for validation.
     * Normalize package_id to always be an array for consistent validation.
     *
     * @return void
     */
    protected function prepareForValidation()
    {
        // Convert single package_id integer to array for backward compatibility
        if ($this->has('package_id') && !is_array($this->package_id) && is_numeric($this->package_id)) {
            $this->merge([
                'package_id' => [(int) $this->package_id]
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        // Get company_id from header (API requests) or from company() helper (web requests)
        $companyId = $this->header('X-COMPANY-ID');
        if (!$companyId && function_exists('company')) {
            $company = company();
            // company() returns Company model or false, check if it's an object with id property
            if ($company && is_object($company) && property_exists($company, 'id')) {
                $companyId = $company->id;
            }
        }
        $companyId = $companyId ? (int) $companyId : null;
        
        // Build package validation rule with company scope
        $packageRule = 'integer';
        if ($companyId) {
            $packageRule = [
                'integer',
                Rule::exists('packages', 'id')->where(function ($query) use ($companyId) {
                    return $query->where('company_id', $companyId);
                })
            ];
        } else {
            // Fallback to basic exists check if company_id is not available
            $packageRule .= '|exists:packages,id';
        }
        
        return [
            // Required contact fields
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'gender' => 'nullable|string|in:male,female',
            
            // Optional contact fields
            'phone' => 'nullable|string|max:50',
            'lead_source_id' => 'nullable|integer|exists:lead_sources,id',
            
            // Optional deal fields
            'package_id' => 'nullable|array',
            'package_id.*' => $packageRule,
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
            'package_id.*.exists' => 'One or more selected packages do not exist or do not belong to your company.',
            'pipeline_id.exists' => 'The selected pipeline does not exist.',
            'pipeline_stage_id.exists' => 'The selected pipeline stage does not exist.',
            'deal_owner_id.exists' => 'The selected deal owner does not exist.',
            'deal_watcher.*.exists' => 'One or more selected deal watchers do not exist.',
            'meeting.meeting_link.url' => 'The meeting link must be a valid URL.',
        ];
    }
}

