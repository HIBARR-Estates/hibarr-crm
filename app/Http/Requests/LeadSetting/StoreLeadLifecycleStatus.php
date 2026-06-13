<?php

namespace App\Http\Requests\LeadSetting;

use App\Http\Requests\CoreRequest;
use App\Models\LeadLifecycleStatus;
use Illuminate\Validation\Rule;

class StoreLeadLifecycleStatus extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = company()->id;

        return [
            'key' => [
                'required',
                'string',
                'max:50',
                'regex:/^[a-z][a-z0-9_]*$/',
                Rule::notIn(LeadLifecycleStatus::systemKeys()),
                Rule::unique('lead_lifecycle_statuses', 'key')->where('company_id', $companyId),
            ],
            'label' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'label_color' => ['required', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'sort_order' => 'nullable|integer|min:0|max:999',
        ];
    }

    public function messages(): array
    {
        return [
            'key.not_in' => __('modules.lead.lifecycleStatusKeyReserved'),
            'key.regex' => __('modules.lead.lifecycleStatusKeyFormat'),
        ];
    }
}
