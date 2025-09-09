<?php

namespace Modules\Letter\Http\Requests\Letter;

use Illuminate\Foundation\Http\FormRequest;

class UpdateRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     */

    public function rules(): array
    {
        $rules = [
            'template_id' => 'required|exists:letter_templates,id',
            'user_id' => 'nullable|exists:users,id',
            'description' => 'required',
            'left' => 'required|numeric',
            'right' => 'required|numeric',
            'top' => 'required|numeric',
            'bottom' => 'required|numeric',
            'description' => 'required|string',
        ];

        if (!$this->user_id) {
            $rules['employeeName'] = 'required|string';
        }

        return $rules;
    }

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

}
