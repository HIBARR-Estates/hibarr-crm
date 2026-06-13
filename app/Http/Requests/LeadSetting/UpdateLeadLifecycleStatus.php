<?php

namespace App\Http\Requests\LeadSetting;

use App\Http\Requests\CoreRequest;

class UpdateLeadLifecycleStatus extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'label' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'label_color' => ['required', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'sort_order' => 'required|integer|min:0|max:999',
        ];
    }
}
