<?php

namespace Modules\Biolinks\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BiolinkSettingRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'branding_url' => 'nullable|url',
            'password' => 'nullable|min:8',
        ];
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

}
