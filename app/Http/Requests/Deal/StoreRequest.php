<?php

namespace App\Http\Requests\Deal;

use App\Enums\DealPackageMode;
use App\Http\Requests\CoreRequest;
use App\Traits\CustomFieldsRequestTrait;
use Illuminate\Validation\Rule;

class StoreRequest extends CoreRequest
{
    use CustomFieldsRequestTrait;

    public function authorize()
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('close_date') && $this->close_date === '') {
            $this->merge(['close_date' => null]);
        }

        $packageMode = DealPackageMode::tryFrom(company()->deal_package_mode ?? DealPackageMode::Multiple->value)
            ?? DealPackageMode::Multiple;

        // Redesign may post a single package/product id; multi mode expects arrays.
        if (
            $packageMode !== DealPackageMode::Single
            && $this->has('package_id')
            && !is_array($this->package_id)
            && $this->package_id !== null
            && $this->package_id !== ''
        ) {
            $this->merge(['package_id' => [(int) $this->package_id]]);
        }

        if (
            $this->has('product_id')
            && !is_array($this->product_id)
            && $this->product_id !== null
            && $this->product_id !== ''
        ) {
            $this->merge(['product_id' => [(int) $this->product_id]]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */

    public function rules()
    {
        $rules = array();

        $rules['lead_contact'] = 'required';
        $rules['name'] = 'required';
        $rules['pipeline'] = 'required';
        $rules['stage_id'] = 'required';
        $rules['close_date'] = 'nullable|date';
        $rules['value'] = 'nullable|numeric|min:0';
        $rules['manual_value'] = 'nullable|numeric|min:0';
        $rules['value_source'] = 'nullable|in:manual,calculated';
        $rules['deal_watcher'] = 'nullable|array';
        $rules['deal_watcher.*'] = 'exists:users,id';

        $packageMode = DealPackageMode::tryFrom(company()->deal_package_mode ?? DealPackageMode::Multiple->value)
            ?? DealPackageMode::Multiple;

        $companyId = company()->id;
        $packageExistsRule = Rule::exists('packages', 'id')->where('company_id', $companyId);

        if ($packageMode === DealPackageMode::Single) {
            $rules['package_id'] = ['nullable', $packageExistsRule];
        } else {
            $rules['package_id'] = 'nullable|array';
            $rules['package_id.*'] = $packageExistsRule;
        }

        $rules = $this->customFieldRules($rules);

        return $rules;
    }

    public function attributes()
    {
        $attributes = [];

        $attributes = $this->customFieldsAttributes($attributes);

        $attributes['name'] = __('modules.deal.dealName');
        $attributes['stage_id'] = __('modules.deal.leadStages');

        return $attributes;
    }

}
