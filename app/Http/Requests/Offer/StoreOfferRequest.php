<?php

namespace App\Http\Requests\Offer;

use App\Enums\OfferType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreOfferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'developer_id' => 'required|exists:developers,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['required', new Enum(OfferType::class)],
            'value' => 'required_unless:type,perks|nullable|numeric|min:0.01',
            'max_discount_amount' => 'nullable|numeric|min:0.01',
            'is_active' => 'boolean',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'project_ids' => 'nullable|array',
            'project_ids.*' => 'integer|exists:developer_projects,id',
            'unit_type_ids' => 'nullable|array',
            'unit_type_ids.*' => 'integer|exists:developer_project_unit_types,id',
            'links' => 'nullable|array',
            'links.*.label' => 'required|string|max:255',
            'links.*.url' => 'required|url|max:2048',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->input('type') === OfferType::PERCENTAGE->value) {
                $value = (float) $this->input('value', 0);
                if ($value > 100) {
                    $validator->errors()->add('value', 'Percentage value cannot exceed 100.');
                }
            }

            // Validate projects belong to the selected developer
            if ($this->filled('project_ids') && $this->filled('developer_id')) {
                $developerProjectIds = \App\Models\DeveloperProject::where('developer_id', $this->input('developer_id'))
                    ->whereIn('id', $this->input('project_ids'))
                    ->pluck('id')
                    ->toArray();

                $invalid = array_diff($this->input('project_ids'), $developerProjectIds);

                if (!empty($invalid)) {
                    $validator->errors()->add('project_ids', 'Some projects do not belong to the selected developer.');
                }
            }
        });
    }
}
