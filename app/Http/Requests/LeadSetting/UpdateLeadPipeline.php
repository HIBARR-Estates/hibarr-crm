<?php

namespace App\Http\Requests\LeadSetting;

use App\Http\Requests\CoreRequest;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Illuminate\Validation\Rule;

class UpdateLeadPipeline extends CoreRequest
{

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
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $dealCustomFieldGroupId = $dealCustomFieldGroup ? $dealCustomFieldGroup->id : 0;

        $rules = [
            'name' => 'required|unique:lead_pipelines,name,'.$this->route('lead_pipeline_setting').',id,company_id,' . company()->id,
            'label_color' => 'required',
            'category_ids' => 'nullable|array',
            'category_ids.*' => [
                'integer',
                Rule::exists('custom_field_categories', 'id')
                    ->where('company_id', company()->id)
                    ->where('custom_field_group_id', $dealCustomFieldGroupId),
            ],
        ];

        return $rules;
    }

}
