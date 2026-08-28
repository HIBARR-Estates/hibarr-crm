<?php

namespace App\Http\Requests\User;

use App\Http\Requests\CoreRequest;
use DateTimeZone;
use Illuminate\Validation\Rule;

class UpdatePreferencesTimezoneRequest extends CoreRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
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
            'locked' => ['required', 'boolean'],
        ];
    }
}
