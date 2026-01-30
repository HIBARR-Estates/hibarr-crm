<?php

namespace App\Http\Requests\Deal;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

class PatchRequest extends CoreRequest
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
        $dealId = $this->route('deal');
        
        return [
            // Contact Information (all optional for patch)
            'client_name' => 'sometimes|string|max:255',
            'client_email' => 'nullable|email|max:255',
            'mobile' => 'nullable|string|max:20',
            'company_name' => 'sometimes|string|max:255',
            'website' => 'sometimes|url|max:255',
            'address' => 'sometimes|string|max:500',
            'city' => 'sometimes|string|max:100',
            'state' => 'sometimes|string|max:100',
            'country_id' => 'sometimes|integer|exists:countries,id',
            'postal_code' => 'sometimes|string|max:20',
            
            // Deal Information (all optional for patch)
            'deal_name' => 'sometimes|string|max:255',
            'value' => 'sometimes|numeric|min:0',
            'currency_id' => 'sometimes|integer|exists:currencies,id',
            'pipeline_stage_id' => 'sometimes|integer|exists:pipeline_stages,id',
            'lead_pipeline_id' => 'sometimes|integer|exists:lead_pipelines,id',
            'close_date' => 'sometimes|date',
            'probability' => 'sometimes|integer|min:0|max:100',
            'note' => 'sometimes|string|max:2000',
            
            // Assignment (all optional for patch)
            'agent_id' => 'sometimes|integer|exists:lead_agents,id',
            'lead_id' => 'sometimes|integer|exists:leads,id',
            
            // Categorization (all optional for patch)
            'category_id' => 'sometimes|integer|exists:lead_category,id',
            'source_id' => 'sometimes|integer|exists:lead_sources,id',
            
            // Products (all optional for patch)
            'products' => 'sometimes|array',
            'products.*' => 'integer|exists:products,id',
            
            // Custom fields (all optional for patch)
            'custom_fields' => 'sometimes|array',
            'custom_fields.*' => 'sometimes',
            
            // Status fields (all optional for patch)
            'status' => ['sometimes', 'string', Rule::in(['active', 'inactive', 'won', 'lost'])],
            'priority' => ['sometimes', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            
            // Additional optional fields
            'next_follow_up_date' => 'sometimes|date|after:today',
            'next_follow_up_time' => 'sometimes|date_format:H:i',
            'tags' => 'sometimes|array',
            'tags.*' => 'string|max:50',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'client_email.email' => 'Please enter a valid email address.',
            'website.url' => 'Please enter a valid website URL.',
            'value.numeric' => 'Deal value must be a valid number.',
            'value.min' => 'Deal value cannot be negative.',
            'probability.min' => 'Probability cannot be less than 0%.',
            'probability.max' => 'Probability cannot be more than 100%.',
            'close_date.date' => 'Please enter a valid close date.',
            'close_date.after' => 'Close date must be in the future.',
            'next_follow_up_date.after' => 'Next follow-up date must be in the future.',
            'next_follow_up_time.date_format' => 'Please enter time in HH:MM format.',
            'products.array' => 'Products must be provided as an array.',
            'products.*.exists' => 'One or more selected products do not exist.',
            'country_id.exists' => 'Selected country is invalid.',
            'currency_id.exists' => 'Selected currency is invalid.',
            'pipeline_stage_id.exists' => 'Selected pipeline stage is invalid.',
            'lead_pipeline_id.exists' => 'Selected pipeline is invalid.',
            'agent_id.exists' => 'Selected agent is invalid.',
            'category_id.exists' => 'Selected category is invalid.',
            'source_id.exists' => 'Selected source is invalid.',
            'status.in' => 'Status must be one of: active, inactive, won, lost.',
            'priority.in' => 'Priority must be one of: low, medium, high, critical.',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes(): array
    {
        return [
            'client_name' => 'contact name',
            'client_email' => 'email address',
            'mobile' => 'phone number',
            'company_name' => 'company name',
            'deal_name' => 'deal name',
            'close_date' => 'expected close date',
            'next_follow_up_date' => 'next follow-up date',
            'next_follow_up_time' => 'follow-up time',
            'pipeline_stage_id' => 'pipeline stage',
            'lead_pipeline_id' => 'pipeline',
            'agent_id' => 'assigned agent',
            'category_id' => 'category',
            'source_id' => 'lead source',
            'country_id' => 'country',
            'currency_id' => 'currency',
        ];
    }
}
