<?php

namespace App\Http\Requests\Offer;

use App\Enums\OfferType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateOfferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'developer_id' => 'sometimes|required|exists:developers,id',
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'type' => ['sometimes', 'required', new Enum(OfferType::class)],
            'value' => 'sometimes|required|numeric|min:0.01',
            'max_discount_amount' => 'nullable|numeric|min:0.01',
            'is_active' => 'boolean',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $type = $this->input('type', $this->route('offer')?->type?->value);

            if ($type === OfferType::PERCENTAGE->value) {
                $value = (float) $this->input('value', $this->route('offer')?->value ?? 0);
                if ($value > 100) {
                    $validator->errors()->add('value', 'Percentage value cannot exceed 100.');
                }
            }
        });
    }
}
