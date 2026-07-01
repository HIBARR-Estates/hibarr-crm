<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StorePackageRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'name' => 'required|string|max:255',
            'value' => 'required|numeric|min:0',
            'description' => 'nullable|string',
            'customer_type_name' => 'nullable|string|max:255',
            'customer_type_description' => 'nullable|string',
            'pipeline_id' => [
                'nullable',
                'integer',
                Rule::exists('lead_pipelines', 'id')->where('company_id', company()->id),
            ],
            'default_stage_id' => [
                Rule::excludeIf(fn () => !$this->filled('pipeline_id')),
                'nullable',
                'integer',
                Rule::exists('pipeline_stages', 'id')
                    ->where('company_id', company()->id)
                    ->where('lead_pipeline_id', $this->input('pipeline_id')),
            ],
            'routing_triggers' => 'nullable|array',
            'routing_triggers.*.field_key' => 'nullable|string|max:100',
            'routing_triggers.*.match_mode' => 'nullable|in:exact,present',
            'routing_triggers.*.match_value' => 'nullable|string|max:500',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ($this->input('routing_triggers', []) as $index => $row) {
                if (!is_array($row)) {
                    continue;
                }

                $hasContent = collect($row)->contains(
                    fn ($value) => $value !== null && $value !== '',
                );

                if (!$hasContent) {
                    continue;
                }

                if (empty($row['field_key'])) {
                    $validator->errors()->add(
                        "routing_triggers.{$index}.field_key",
                        __('validation.required', ['attribute' => 'field key']),
                    );
                }

                if (empty($row['match_mode'])) {
                    $validator->errors()->add(
                        "routing_triggers.{$index}.match_mode",
                        __('validation.required', ['attribute' => 'match mode']),
                    );
                }

                if (($row['match_mode'] ?? null) === 'exact' && !filled($row['match_value'] ?? null)) {
                    $validator->errors()->add(
                        "routing_triggers.{$index}.match_value",
                        __('validation.required', ['attribute' => 'match value']),
                    );
                }
            }
        });
    }
}
