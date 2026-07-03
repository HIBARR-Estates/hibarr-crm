<?php

namespace App\Http\Requests\ApiV2\CrmWrite\Concerns;

use App\Models\Deal;
use App\Scopes\CompanyScope;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

trait ValidatesCrmWriteTargets
{
    protected function prepareCrmWriteTargetValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;

        $this->merge(['companyId' => $companyId]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function crmWriteTargetRules(): array
    {
        $companyId = (int) $this->input('companyId');

        return [
            'lead_id' => [
                'nullable',
                'integer',
                Rule::exists('leads', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'deal_id' => [
                'nullable',
                'integer',
                Rule::exists('deals', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
            'created_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', $companyId)),
            ],
        ];
    }

    protected function validateCrmWriteTargets(Validator $validator): void
    {
        if (!$this->filled('lead_id') && !$this->filled('deal_id')) {
            $message = __('messages.crmWriteTargetRequired');
            $validator->errors()->add('lead_id', $message);
            $validator->errors()->add('deal_id', $message);
        }

        if (!$this->filled('lead_id') || !$this->filled('deal_id')) {
            return;
        }

        $dealBelongsToLead = Deal::withoutGlobalScope(CompanyScope::class)
            ->where('id', $this->input('deal_id'))
            ->where('lead_id', $this->input('lead_id'))
            ->exists();

        if (!$dealBelongsToLead) {
            $validator->errors()->add('deal_id', __('messages.invalidDealForLead'));
        }
    }
}
