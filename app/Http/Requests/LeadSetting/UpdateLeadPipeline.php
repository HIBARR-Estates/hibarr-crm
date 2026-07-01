<?php

namespace App\Http\Requests\LeadSetting;

use App\Http\Requests\CoreRequest;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Illuminate\Validation\Rule;

class UpdateLeadPipeline extends CoreRequest
{

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $dealCustomFieldGroupId = $dealCustomFieldGroup ? $dealCustomFieldGroup->id : 0;

        $categoryRule = [
            'integer',
            Rule::exists('custom_field_categories', 'id')
                ->where('company_id', company()->id)
                ->where('custom_field_group_id', $dealCustomFieldGroupId),
        ];

        return [
            'name' => 'required|unique:lead_pipelines,name,'.$this->route('lead_pipeline_setting').',id,company_id,' . company()->id,
            'label_color' => 'required',
            'category_ids' => 'nullable|array',
            'category_ids.*' => $categoryRule,
            'category_scopes' => 'nullable|array',
            'category_scopes.__pipeline__' => 'nullable|array',
            'category_scopes.__pipeline__.*' => $categoryRule,
            'category_scopes.*' => 'nullable|array',
            'category_scopes.*.*' => $categoryRule,
            'field_scopes' => 'nullable|array',
            'field_scopes.__pipeline__' => 'nullable|array',
            'field_scopes.__pipeline__.*' => 'string',
            'field_scopes.*' => 'nullable|array',
            'field_scopes.*.*' => 'string',
        ];
    }

}
