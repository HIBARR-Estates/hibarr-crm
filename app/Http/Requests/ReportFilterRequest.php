<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReportFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'agent_id' => ['nullable', 'integer', 'exists:lead_agents,id'],
            'view_type' => ['nullable', 'in:agent,department'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'start_date' => $this->input('start_date', now()->startOfWeek()->toDateString()),
            'end_date' => $this->input('end_date', now()->endOfWeek()->toDateString()),
            'view_type' => $this->input('view_type', 'agent'),
        ]);
    }
}
