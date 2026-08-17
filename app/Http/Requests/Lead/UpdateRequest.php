<?php

namespace App\Http\Requests\Lead;

use App\Enums\PreferredContactTime;
use App\Enums\Salutation;
use App\Http\Requests\CoreRequest;
use App\Services\LeadCoreFieldsService;
use App\Traits\CustomFieldsRequestTrait;
use Illuminate\Validation\Rule;

class UpdateRequest extends CoreRequest
{
    use CustomFieldsRequestTrait;

    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('salutation') && $this->salutation === '') {
            $this->merge(['salutation' => null]);
        }

        if ($this->has('preferred_contact_time') && is_array($this->input('preferred_contact_time'))) {
            $this->merge([
                'preferred_contact_times' => $this->input('preferred_contact_time'),
            ]);
            $this->offsetUnset('preferred_contact_time');
        }

        if ($this->has('preferred_contact_times')) {
            $this->merge([
                'preferred_contact_times' => PreferredContactTime::normalizeList(
                    $this->input('preferred_contact_times')
                ),
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $rules = [
            'client_name' => 'required',
            'client_email' => 'nullable|email:rfc,strict|unique:leads,client_email,'.$this->route('lead_contact').',id,company_id,'.company()->id,
            'salutation' => ['nullable', 'string', Rule::in(array_column(Salutation::cases(), 'value'))],
            'gender' => 'nullable|in:male,female',
            'temperature' => 'nullable|in:cold,warm,hot',
            'preferred_contact_time' => ['nullable', Rule::in(PreferredContactTime::values())],
            'preferred_contact_times' => 'nullable|array',
            'preferred_contact_times.*' => ['string', Rule::in(PreferredContactTime::values())],
            'lead_lifecycle_status_id' => 'sometimes|nullable|integer|exists:lead_lifecycle_statuses,id',
        ];

        $rules = $this->customFieldRules($rules);

        return array_merge($rules, app(LeadCoreFieldsService::class)->validationRules());
    }

    public function attributes()
    {
        $attributes = [];

        $attributes = $this->customFieldsAttributes($attributes);

        $attributes['client_name'] = __('app.name');
        $attributes['client_email'] = __('app.email');

        return $attributes;
    }
}
