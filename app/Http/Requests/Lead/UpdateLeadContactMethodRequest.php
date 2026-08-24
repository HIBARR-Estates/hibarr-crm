<?php

namespace App\Http\Requests\Lead;

use App\Enums\LeadContactMethodType;
use App\Http\Requests\CoreRequest;
use App\Models\LeadContactMethod;
use Illuminate\Validation\Validator;

class UpdateLeadContactMethodRequest extends CoreRequest
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
            'identifier' => ['required'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $method = $this->route('contact_method');
            $type = $method instanceof LeadContactMethod
                ? ($method->type instanceof LeadContactMethodType ? $method->type->value : (string) $method->type)
                : null;

            if ($type !== LeadContactMethodType::Email->value) {
                return;
            }

            $identifier = $this->input('identifier');
            if (! is_string($identifier)) {
                $validator->errors()->add('identifier', 'Please enter a valid email address.');

                return;
            }

            $emailValidator = \Illuminate\Support\Facades\Validator::make(
                ['identifier' => $identifier],
                ['identifier' => 'email:rfc,strict|max:255'],
            );

            if ($emailValidator->fails()) {
                $validator->errors()->add('identifier', 'Please enter a valid email address.');
            }
        });
    }
}
