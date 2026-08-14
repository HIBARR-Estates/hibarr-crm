<?php

namespace App\Http\Requests\Deal;

use App\Enums\PreferredContactTime;
use App\Http\Requests\CoreRequest;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
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

        // Accept alternate key used by some clients
        if ($this->has('deal_participants') && !$this->has('deal_participant')) {
            $this->merge(['deal_participant' => $this->input('deal_participants')]);
        }

        // Convert single participant/watcher integer to array for backward compatibility
        foreach (['deal_participant', 'deal_watcher'] as $field) {
            if ($this->has($field) && !is_array($this->input($field)) && is_numeric($this->input($field))) {
                $this->merge([$field => [(int) $this->input($field)]]);
            }
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
            // company() returns Company model (Eloquent) or false
            // Use isset() to check for magic property access, which works with Eloquent models
            if ($company && is_object($company) && isset($company->id)) {
                $companyId = $company->id;
            }
        }
        $companyId = $companyId ? (int) $companyId : null;
        
        // Get the Deal custom field group once (outside validation loop to avoid N+1 queries)
        // Filter by company_id when available to ensure company isolation and prevent cross-company access
        $dealFieldGroupQuery = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL);
        if ($companyId) {
            $dealFieldGroupQuery->where('company_id', $companyId);
        }
        $dealFieldGroup = $dealFieldGroupQuery->first();
        
        // Build package validation rule with company scope
        // Security: Require company context - fail validation if companyId is not available
        $packageRule = 'integer';
        if ($companyId) {
            $packageRule = [
                'integer',
                Rule::exists('packages', 'id')->where(function ($query) use ($companyId) {
                    return $query->where('company_id', $companyId);
                })
            ];
        } else {
            // Fail validation when company context is missing to prevent cross-company package selection
            $packageRule = [
                'integer',
                function ($attribute, $value, $fail) {
                    $fail('Package selection requires company context. Please provide X-COMPANY-ID header or ensure you are authenticated.');
                }
            ];
        }

        $dealUserRule = 'integer|exists:users,id';
        if ($companyId) {
            $dealUserRule = [
                'integer',
                Rule::exists('users', 'id')->where(function ($query) use ($companyId) {
                    return $query->where('company_id', $companyId);
                }),
            ];
        } else {
            $dealUserRule = [
                'integer',
                function ($attribute, $value, $fail) {
                    $fail('Deal watcher and participant selection requires company context. Please provide X-COMPANY-ID header or ensure you are authenticated.');
                },
            ];
        }
        
        return [
            // Required contact fields
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'gender' => 'nullable|string|in:male,female',
            
            // Optional contact fields
            'phone' => 'nullable|string|max:50',
            'lead_source_id' => 'nullable|integer|exists:lead_sources,id',
            'referral_agent_id' => 'nullable|integer',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'postal_code' => 'nullable|string|max:255',
            'date_of_birth' => 'nullable|date',

            // Optional lead classification / engagement (applied to the contact)
            'temperature' => 'nullable|string|in:cold,warm,hot',
            'preferred_contact_time' => ['nullable', 'string', Rule::in(PreferredContactTime::values())],
            'lead_lifecycle_status_id' => 'nullable|integer|exists:lead_lifecycle_statuses,id',
            'has_joined_the_whatsapp_group' => 'nullable|boolean',

            // Optional lead custom fields (separate from deal custom_fields below)
            // Format: {"131": "value", "132": ["a","b"]}
            'lead_custom_fields' => 'nullable|array',
            'lead_custom_fields.*' => 'nullable',

            // Optional deal fields
            'package_id' => 'nullable|array',
            'package_id.*' => $packageRule,
            'pipeline_id' => 'nullable|integer|exists:lead_pipelines,id',
            'pipeline_stage_id' => 'nullable|integer|exists:pipeline_stages,id',
            'deal_owner_id' => 'nullable|integer|exists:users,id',
            'update_agent_if_exists' => 'nullable|boolean',
            'deal_watcher' => 'nullable|array',
            'deal_watcher.*' => $dealUserRule,
            'deal_participant' => 'nullable|array',
            'deal_participant.*' => $dealUserRule,
            
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
            
            // Optional custom fields (format: {"131": "value", "132": "value"})
            'custom_fields' => 'nullable|array',
            'custom_fields.*' => [
                'nullable',
                function ($attribute, $value, $fail) use ($companyId, $dealFieldGroup) {
                    // Extract field ID from attribute (e.g., "custom_fields.131" -> 131)
                    $fieldId = (int) str_replace('custom_fields.', '', $attribute);
                    
                    if ($fieldId <= 0) {
                        $fail('Invalid custom field ID format.');
                        return;
                    }
                    
                    // Check if Deal custom field group exists (queried once outside this closure)
                    if (!$dealFieldGroup) {
                        if ($companyId) {
                            $fail('Deal custom field group not found for your company.');
                        } else {
                            $fail('Deal custom field group not found.');
                        }
                        return;
                    }
                    
                    // Check if custom field exists and belongs to Deal model
                    $customField = CustomField::where('id', $fieldId)
                        ->where('custom_field_group_id', $dealFieldGroup->id)
                        ->first();
                    
                    if (!$customField) {
                        $fail("Custom field with ID {$fieldId} does not exist or is not valid for deals.");
                        return;
                    }
                    
                    // If company_id is available, validate company scope
                    if ($companyId && $customField->company_id && $customField->company_id !== $companyId) {
                        $fail("Custom field with ID {$fieldId} does not belong to your company.");
                        return;
                    }
                }
            ],
            
            // Optional custom_fields_data format (backward compatibility)
            'custom_fields_data' => 'nullable|array',
            'custom_fields_data.*' => 'nullable',
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
            'deal_watcher.*.exists' => 'One or more selected deal watchers do not exist or do not belong to your company.',
            'deal_participant.*.exists' => 'One or more selected deal participants do not exist or do not belong to your company.',
            'meeting.meeting_link.url' => 'The meeting link must be a valid URL.',
            'custom_fields.*' => 'One or more custom fields are invalid.',
        ];
    }
}

