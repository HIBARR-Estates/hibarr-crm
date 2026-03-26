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
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['required', new Enum(OfferType::class)],
            'value' => 'required|numeric|min:0.01',
            'max_discount_amount' => 'nullable|numeric|min:0.01',
            'is_active' => 'boolean',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
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
        });
    }
}
