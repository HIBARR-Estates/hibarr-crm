<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateNoteV2Request extends CoreRequest
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
        return [
            'type' => 'required|in:lead,deal',
            'title' => 'sometimes|required|string|max:255',
            'details' => 'sometimes|required|string',
            'updated_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', (int) $this->input('companyId'))),
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (!$this->filled('details')) {
                return;
            }

            $details = trim(strip_tags((string) $this->input('details')));
            if ($details === '') {
                $validator->errors()->add('details', __('validation.required', ['attribute' => 'details']));
            }
        });
    }
}
