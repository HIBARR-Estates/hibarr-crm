<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

class UpdateTaskV2Request extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $companyId = $this->header('X-COMPANY-ID');
        $companyId = $companyId && is_numeric($companyId) ? (int) $companyId : null;
        $this->merge(['companyId' => $companyId]);
    }

    public function rules(): array
    {
        return [
            'heading' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'nullable|in:low,medium,high',
            'due_date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'assignee_user_ids' => 'nullable|array',
            'assignee_user_ids.*' => [
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', (int) $this->input('companyId'))),
            ],
            'updated_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('company_id', (int) $this->input('companyId'))),
            ],
        ];
    }
}
