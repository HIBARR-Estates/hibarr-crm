<?php

namespace App\Http\Requests;

use App\Services\PackageRoutingFieldCatalog;
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
                Rule::excludeIf(fn () => ! $this->filled('pipeline_id')),
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
            $errors = app(PackageRoutingFieldCatalog::class)->validateTriggerRows(
                $this->input('routing_triggers', []),
                company()->id,
            );

            foreach ($errors as $key => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add($key, $message);
                }
            }
        });
    }
}
