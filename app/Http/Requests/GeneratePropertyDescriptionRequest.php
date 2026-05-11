<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GeneratePropertyDescriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'form_data' => ['required', 'array'],
            'feature_context' => ['nullable', 'string', 'in:property_description,location_description'],
        ];
    }
}
