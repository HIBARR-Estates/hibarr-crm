<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ListCrmWriteV2Request extends CoreRequest
{
    use ValidatesCrmWriteTargets;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->prepareCrmWriteTargetValidation();
    }

    public function rules(): array
    {
        $companyId = (int) $this->input('companyId');

        $companyUserRule = [
            'nullable',
            'integer',
            Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
        ];

        return array_merge($this->crmWriteTargetRules(), [
            'type' => 'nullable|in:lead,deal',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:255',
            'created_by' => $companyUserRule,
            'owned_by' => $companyUserRule,
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
        ]);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->filled('lead_id') && $this->filled('deal_id')) {
                $this->validateCrmWriteTargets($validator);
            }
        });
    }
}
