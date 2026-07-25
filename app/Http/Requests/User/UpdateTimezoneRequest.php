<?php

namespace App\Http\Requests\User;

use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;

class UpdateTimezoneRequest extends CoreRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'timezone' => [
                'required',
                'string',
                'max:64',
                Rule::in(DateTimeZone::listIdentifiers()),
            ],
        ];
    }
}
