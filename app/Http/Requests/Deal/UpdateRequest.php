<?php

namespace App\Http\Requests\Deal;

use App\Http\Requests\CoreRequest;
use App\Traits\CustomFieldsRequestTrait;

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

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation()
    {
        // Convert empty string to null for close_date
        if ($this->has('close_date') && $this->close_date === '') {
            $this->merge(['close_date' => null]);
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

        $rules['name'] = 'required';
        $rules['pipeline'] = 'required';
        $rules['stage_id'] = 'required';
        $rules['close_date'] = 'nullable';
        $rules['value'] = 'nullable|numeric|min:0';
        $rules['manual_value'] = 'nullable|numeric|min:0';
        $rules['value_source'] = 'nullable|in:manual,calculated';
        $rules['deal_watcher'] = 'nullable|array';
        $rules['deal_watcher.*'] = 'exists:users,id';
        $rules['package_id'] = 'nullable|array';
        $rules['package_id.*'] = 'exists:packages,id';

        $rules = $this->customFieldRules($rules);

        return $rules;
    }

    public function attributes()
    {
        $attributes = [];

        $attributes = $this->customFieldsAttributes($attributes);

        $attributes['name'] = __('app.deal').' '.__('app.name');

        return $attributes;
    }

}
