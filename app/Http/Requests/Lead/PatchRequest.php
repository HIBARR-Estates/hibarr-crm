<?php

namespace App\Http\Requests\Lead;

use App\Enums\PreferredContactTime;
use App\Enums\Salutation;
use App\Http\Requests\CoreRequest;
use App\Services\LeadCoreFieldsService;
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

    protected function prepareForValidation(): void
    {
        if ($this->has('salutation') && $this->salutation === '') {
            $this->merge(['salutation' => null]);
        }

        if ($this->has('preferred_contact_time') && is_array($this->input('preferred_contact_time'))) {
            $this->merge([
                'preferred_contact_times' => $this->input('preferred_contact_time'),
            ]);
            $this->offsetUnset('preferred_contact_time');
        }

        if ($this->has('preferred_contact_times')) {
            $this->merge([
                'preferred_contact_times' => PreferredContactTime::normalizeList(
                    $this->input('preferred_contact_times')
                ),
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $leadId = $this->route('lead_contact');
        
        return [
            // Contact Information (all optional for patch)
            // client_name is NOT NULL at the DB level, so this intentionally
            // stays non-nullable — clearing it should surface a friendly
            // validation error rather than a DB constraint failure.
            'client_name' => 'sometimes|string|max:255',
            'client_email' => 'nullable|email:rfc,strict|max:255',
            'mobile' => 'nullable|string|max:100',
            'cell' => 'sometimes|nullable|string|max:100',
            'office' => 'sometimes|nullable|string|max:100',
            'client_whatsapp' => 'sometimes|nullable|string|max:100',
            'client_telegram' => 'sometimes|nullable|string|max:100',
            'client_instagram' => 'sometimes|nullable|string|max:100',
            'company_name' => 'sometimes|nullable|string|max:255',
            'website' => 'sometimes|nullable|url|max:255',
            'address' => 'sometimes|nullable|string|max:500',
            'city' => 'sometimes|nullable|string|max:100',
            'state' => 'sometimes|nullable|string|max:100',
            'country' => 'sometimes|nullable|string|max:100',
            'postal_code' => 'sometimes|nullable|string|max:20',
            'salutation' => ['sometimes', 'nullable', 'string', Rule::in(array_column(Salutation::cases(), 'value'))],
            'gender' => ['sometimes', 'nullable', 'string', Rule::in(['male', 'female'])],
            'temperature' => ['sometimes', 'nullable', 'string', Rule::in(\App\Enums\LeadTemperature::values())],
            'preferred_contact_time' => ['sometimes', 'nullable', 'string', Rule::in(PreferredContactTime::values())],
            'preferred_contact_times' => 'sometimes|nullable|array',
            'preferred_contact_times.*' => ['string', Rule::in(PreferredContactTime::values())],

            // Lead Information (all optional for patch)
            'value' => 'sometimes|numeric|min:0',
            'currency_id' => 'sometimes|integer|exists:currencies,id',
            'next_follow_up' => 'sometimes|nullable|date|after:today',
            'note' => 'sometimes|nullable|string|max:2000',
            
            // Assignment (all optional for patch)
            'agent_id' => 'sometimes|nullable|integer|exists:lead_agents,id',
            // Write-once — LeadObserver rejects any attempt to change an existing referrer.
            'referred_by_agent_id' => 'sometimes|nullable|integer|exists:lead_agents,id',
            'lead_owner' => 'sometimes|nullable|integer|exists:users,id',
            'added_by' => 'sometimes|nullable|integer|exists:users,id',
            
            // Categorization — multi via category_ids; scalar category_id still accepted
            'category_id' => 'sometimes|nullable|integer|exists:lead_category,id',
            'category_ids' => 'sometimes|nullable|array',
            'category_ids.*' => 'integer|exists:lead_category,id',
            'source_id' => 'sometimes|nullable|integer|exists:lead_sources,id',
            'status_id' => 'sometimes|nullable|integer|exists:lead_statuses,id',
            'lead_lifecycle_status_id' => 'sometimes|nullable|integer|exists:lead_lifecycle_statuses,id',
            'has_joined_the_whatsapp_group' => 'sometimes|boolean',

            // Products (all optional for patch)
            'products' => 'sometimes|array',
            'products.*' => 'integer|exists:products,id',
            
            // Custom fields (all optional for patch)
            'custom_fields' => 'sometimes|array',
            'custom_fields.*' => 'sometimes',
            
            // Priority and status fields (all optional for patch)
            'column_priority' => 'sometimes|integer|min:0',
            'total_value' => 'sometimes|numeric|min:0',
            
            // Lead conversion fields (all optional for patch)
            'client_id' => 'sometimes|integer|exists:users,id',
            'hash' => 'sometimes|string|max:255',
            
            // Additional optional fields
            'tags' => 'sometimes|array',
            'tags.*' => 'string|max:50',

            ...app(LeadCoreFieldsService::class)->validationRules(sometimes: true),
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
            'value.numeric' => 'Lead value must be a valid number.',
            'value.min' => 'Lead value cannot be negative.',
            'total_value.numeric' => 'Total value must be a valid number.',
            'total_value.min' => 'Total value cannot be negative.',
            'next_follow_up.date' => 'Please enter a valid follow-up date.',
            'next_follow_up.after' => 'Follow-up date must be in the future.',
            'products.array' => 'Products must be provided as an array.',
            'products.*.exists' => 'One or more selected products do not exist.',
            'currency_id.exists' => 'Selected currency is invalid.',
            'agent_id.exists' => 'Selected agent is invalid.',
            'referred_by_agent_id.exists' => 'Selected referrer is invalid.',
            'lead_owner.exists' => 'Selected lead owner is invalid.',
            'added_by.exists' => 'Selected user is invalid.',
            'category_id.exists' => 'Selected category is invalid.',
            'category_ids.array' => 'Categories must be provided as an array.',
            'category_ids.*.exists' => 'One or more selected categories do not exist.',
            'source_id.exists' => 'Selected source is invalid.',
            'status_id.exists' => 'Selected status is invalid.',
            'client_id.exists' => 'Selected client is invalid.',
            'salutation.in' => 'Salutation must be one of: ' . implode(', ', array_column(Salutation::cases(), 'value')) . '.',
            'column_priority.min' => 'Priority cannot be negative.',
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
            'mobile' => 'mobile number',
            'cell' => 'cell phone',
            'office' => 'office phone',
            'company_name' => 'company name',
            'postal_code' => 'postal code',
            'next_follow_up' => 'next follow-up date',
            'agent_id' => 'assigned agent',
            'referred_by_agent_id' => 'referrer',
            'lead_owner' => 'lead owner',
            'added_by' => 'added by',
            'category_id' => 'category',
            'category_ids' => 'categories',
            'source_id' => 'lead source',
            'status_id' => 'status',
            'currency_id' => 'currency',
            'client_id' => 'client',
            'column_priority' => 'priority',
            'total_value' => 'total value',
        ];
    }
}
