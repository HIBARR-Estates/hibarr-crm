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

    public function rules()
    {
        $rules = array();

        $rules['lead_contact'] = 'required';
        $rules['name'] = 'required';
        $rules['pipeline'] = 'required';
        $rules['stage_id'] = 'required';
        $rules['close_date'] = 'nullable';
        $rules['value'] = 'nullable|numeric|min:0';
        $rules['manual_value'] = 'nullable|numeric|min:0';
        $rules['value_source'] = 'nullable|in:manual,calculated';
        $rules['deal_watcher'] = 'nullable|array';
        $rules['deal_watcher.*'] = 'exists:users,id';

        $packageMode = DealPackageMode::tryFrom(company()->deal_package_mode ?? DealPackageMode::Multiple->value)
            ?? DealPackageMode::Multiple;

        if ($packageMode === DealPackageMode::Single) {
            $rules['package_id'] = ['nullable', Rule::exists('packages', 'id')];
        } else {
            $rules['package_id'] = 'nullable|array';
            $rules['package_id.*'] = 'exists:packages,id';
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
