<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Enums\ExternalSource;
use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateNoteV2Request extends CoreRequest
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
            'title' => 'required|string|max:255',
            'details' => 'required|string',
            'remind_at' => 'nullable|date',
            'external_source' => ['nullable', Rule::enum(ExternalSource::class)],
        ]);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->validateCrmWriteTargets($validator);

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $details = trim(strip_tags((string) $this->input('details')));
            if ($details === '') {
                $validator->errors()->add('details', __('validation.required', ['attribute' => 'details']));
            }
        });
    }
}
