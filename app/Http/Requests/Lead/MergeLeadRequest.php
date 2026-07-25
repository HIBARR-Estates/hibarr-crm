<?php

namespace App\Http\Requests\Lead;

use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;

class MergeLeadRequest extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'duplicate_id' => [
                'required',
                'integer',
                Rule::exists('leads', 'id')->whereNull('deleted_at'),
            ],
            'lead_owner' => ['nullable', 'integer'],
            'added_by' => ['nullable', 'integer'],
            'client_id' => ['nullable', 'integer'],
            'agent_id' => ['nullable', 'integer'],
        ];
    }
}
