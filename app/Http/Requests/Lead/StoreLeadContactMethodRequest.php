<?php

namespace App\Http\Requests\Lead;

use App\Enums\LeadContactMethodType;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreLeadContactMethodRequest extends CoreRequest
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
            'type' => ['required', Rule::enum(LeadContactMethodType::class)],
            'identifier' => ['required'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->input('type') !== LeadContactMethodType::Email->value) {
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
