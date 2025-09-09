<?php

namespace Modules\Biolinks\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EmailCollectorRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
            ]
        ];

        if (request()->is_agreement == 1) {
            $rules['agreement'] = ['accepted'];
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
