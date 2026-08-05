<?php

namespace App\Http\Requests\LeadSetting;

use App\Http\Requests\CoreRequest;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Services\PipelineScopeResolverService;
use Illuminate\Validation\Rule;

class UpdateLeadPipeline extends CoreRequest
{

    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('company_id', company()->id)
            ->first();
        $dealCustomFieldGroupId = $dealCustomFieldGroup ? $dealCustomFieldGroup->id : 0;

        $categoryRule = [
            'integer',
            Rule::exists('custom_field_categories', 'id')
                ->where('company_id', company()->id)
                ->where('custom_field_group_id', $dealCustomFieldGroupId),
        ];

        $allowedFieldScopeKeys = $this->allowedFieldScopeKeys();

        return [
            'name' => 'required|unique:lead_pipelines,name,'.$this->route('lead_pipeline_setting').',id,company_id,' . company()->id,
            'label_color' => 'required',
            'hide_all_categories' => 'nullable|boolean',
            'category_ids' => 'nullable|array',
            'category_ids.*' => $categoryRule,
            'category_scopes' => 'nullable|array',
            'category_scopes.__pipeline__' => 'nullable|array',
            'category_scopes.__pipeline__.*' => $categoryRule,
            'category_scopes.*' => 'nullable|array',
            'category_scopes.*.*' => $categoryRule,
            'field_scopes' => 'nullable|array',
            'field_scopes.__pipeline__' => 'nullable|array',
            'field_scopes.__pipeline__.*' => ['string', Rule::in($allowedFieldScopeKeys)],
            'field_scopes.*' => 'nullable|array',
            'field_scopes.*.*' => ['string', Rule::in($allowedFieldScopeKeys)],
        ];
    }

    /**
     * @return array<int, string>
     */
    protected function allowedFieldScopeKeys(): array
    {
        $catalog = app(PipelineScopeResolverService::class)->getScopeableFieldsCatalog();
        $keys = [];

        foreach ($catalog as $model => $fields) {
            foreach (array_keys($fields) as $fieldKey) {
                $keys[] = $model . '|' . $this->scopeableTypeFor($fieldKey) . '|' . $fieldKey;
            }
        }

        return $keys;
    }

    /**
     * Mirrors the type re-derivation in LeadPipelineSettingController::syncFieldScopes()
     * so the validation whitelist matches what's actually accepted on save.
     */
    protected function scopeableTypeFor(string $fieldKey): string
    {
        if (str_starts_with($fieldKey, 'custom_field_')) {
            return \App\Models\PipelineFieldScope::TYPE_CUSTOM_FIELD;
        }

        if (in_array($fieldKey, array_keys(PipelineScopeResolverService::HIBARR_FIELDS), true)) {
            return \App\Models\PipelineFieldScope::TYPE_HIBARR_FIELD;
        }

        return \App\Models\PipelineFieldScope::TYPE_NATIVE_FIELD;
    }

}
