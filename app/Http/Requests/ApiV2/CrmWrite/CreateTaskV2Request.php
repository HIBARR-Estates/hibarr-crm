<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Enums\ExternalSource;
use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateTaskV2Request extends CoreRequest
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
        return array_merge($this->crmWriteTargetRules(), [
            'heading' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'nullable|in:low,medium,high',
            'due_date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'assignee_user_ids' => 'nullable|array',
            'assignee_user_ids.*' => [
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', (int) $this->input('companyId'))),
            ],
            'external_source' => ['nullable', Rule::enum(ExternalSource::class)],
        ]);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->validateCrmWriteTargets($validator);
        });
    }
}
