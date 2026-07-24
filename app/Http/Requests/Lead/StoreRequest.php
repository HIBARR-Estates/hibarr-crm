<?php

namespace App\Http\Requests\Lead;

use App\Http\Requests\CoreRequest;
use App\Services\LeadCoreFieldsService;
use App\Traits\CustomFieldsRequestTrait;

class StoreRequest extends CoreRequest
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

        $rules['client_name'] = 'required';
        $rules['client_email'] = 'nullable|email:rfc,strict|unique:leads,client_email,null,id,company_id,' . company()->id;
        $rules['gender'] = 'nullable|in:male,female';
        $rules['lead_lifecycle_status_id'] = 'sometimes|nullable|integer|exists:lead_lifecycle_statuses,id';

        if (request()->boolean('create_deal')) {
            $rules['name'] = 'required';
            $rules['pipeline'] = 'required';
            $rules['stage_id'] = 'required';
            $rules['close_date'] = 'nullable|date';
            $rules['value'] = 'required';
        }

        $rules = $this->customFieldRules($rules);

        return array_merge($rules, app(LeadCoreFieldsService::class)->validationRules());
    }

    public function attributes()
    {
        $attributes = [];

        $attributes = $this->customFieldsAttributes($attributes);

        $attributes['client_name'] = __('app.name');
        $attributes['client_email'] = __('app.email');
        $attributes['name'] = __('modules.deal.dealName');
        $attributes['stage_id'] = __('modules.deal.leadStages');

        return $attributes;
    }

}
