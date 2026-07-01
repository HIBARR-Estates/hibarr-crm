<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\StoreLeadPipeline;
use App\Http\Requests\LeadSetting\UpdateLeadPipeline;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Services\PipelineScopeResolverService;
use Illuminate\Support\Facades\DB;

class LeadPipelineSettingController extends AccountBaseController
{

    public function __construct(
        protected PipelineScopeResolverService $scopeResolver
    ) {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(!(user()->permission('manage_lead_setting') == 'all' && in_array('leads', $this->user->modules)));
            return $next($request);
        });
    }

    public function create()
    {
        $this->pipelines = LeadPipeline::all();

        return view('lead-settings.create-pipeline-modal', $this->data);
    }

    public function store(StoreLeadPipeline $request)
    {
        $pipeline = new LeadPipeline();
        $pipeline->name = $request->name;
        $pipeline->label_color = $request->label_color;
        $pipeline->added_by = user()->id;
        $pipeline->save();

        return Reply::success(__('messages.recordSaved'));
    }

    public function edit($id)
    {
        $this->pipeline = LeadPipeline::with(['customFieldCategoryScopes', 'stages'])
            ->where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();
        $this->maxPriority = LeadPipeline::max('priority');

        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $this->customFieldCategories = collect();
        if ($dealCustomFieldGroup) {
            $this->customFieldCategories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get();
        }

        $this->categoryScopes = $this->scopeResolver->getCategoryScopesForPipeline($this->pipeline);
        $this->scopeableFieldsCatalog = $this->scopeResolver->getScopeableFieldsCatalog();
        $this->pipelineFieldScopes = \App\Models\PipelineFieldScope::where('pipeline_id', $this->pipeline->id)->get();
        $this->pipelineFieldScopeMap = $this->buildFieldScopeMap($this->pipelineFieldScopes);

        return view('lead-settings.edit-pipeline-modal', $this->data);
    }

    public function update(UpdateLeadPipeline $request, $id)
    {
        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();
        $pipeline->name = $request->name;
        $pipeline->label_color = $request->label_color;
        $pipeline->save();

        $validated = $request->validated();
        $categoryScopes = $validated['category_scopes'] ?? [];

        if (empty($categoryScopes) && isset($validated['category_ids'])) {
            $categoryScopes = [
                '__pipeline__' => $validated['category_ids'],
            ];
        }

        $this->scopeResolver->syncCategoryScopes($pipeline, $categoryScopes);

        $fieldScopes = $validated['field_scopes'] ?? $request->input('field_scopes', []);
        $this->syncFieldScopes($pipeline, is_array($fieldScopes) ? $fieldScopes : []);

        return Reply::success(__('messages.updateSuccess'));
    }

    public function statusUpdate($id)
    {
        $allLeadSPipelines = LeadPipeline::select('id', 'default')->get();

        foreach ($allLeadSPipelines as $pipeline) {
            if ($pipeline->id == $id) {
                $pipeline->default = '1';
            } else {
                $pipeline->default = '0';
            }

            $pipeline->save();
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function destroy($id)
    {
        \App\Models\Deal::where('lead_pipeline_id', $id)->where('is_locked', false)->delete();
        PipelineStage::where('lead_pipeline_id', $id)->delete();

        LeadPipeline::destroy($id);

        return Reply::success(__('messages.deleteSuccess'));
    }

    protected function buildFieldScopeMap($scopes): array
    {
        $map = [
            '__pipeline__' => [],
            'stages' => [],
        ];

        foreach ($scopes as $scope) {
            $displayKey = $scope->scopeable_key;
            if ($scope->scopeable_type === \App\Models\PipelineFieldScope::TYPE_CUSTOM_FIELD) {
                $displayKey = 'custom_field_' . $scope->scopeable_key;
            }

            $key = $scope->model . '|native_field|' . $displayKey;

            if ($scope->pipeline_stage_id === null) {
                $map['__pipeline__'][] = $key;
            } else {
                $map['stages'][(int) $scope->pipeline_stage_id][] = $key;
            }
        }

        return $map;
    }

    protected function syncFieldScopes(LeadPipeline $pipeline, array $fieldScopes): void
    {
        $validStageIds = $pipeline->stages()->pluck('id')->map(fn ($stageId) => (int) $stageId)->all();
        $rows = [];

        foreach ($fieldScopes as $stageKey => $fieldKeys) {
            if (!is_array($fieldKeys)) {
                continue;
            }

            if ($stageKey !== '__pipeline__' && !in_array((int) $stageKey, $validStageIds, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'field_scopes' => __('validation.exists', ['attribute' => 'field_scopes']),
                ]);
            }

            $stageId = $stageKey === '__pipeline__' ? null : (int) $stageKey;

            foreach (array_unique(array_filter($fieldKeys)) as $fieldKey) {
                $parts = explode('|', $fieldKey, 3);
                if (count($parts) !== 3) {
                    continue;
                }

                [$model, $scopeableType, $scopeableKey] = $parts;

                if (str_starts_with($scopeableKey, 'custom_field_')) {
                    $scopeableType = \App\Models\PipelineFieldScope::TYPE_CUSTOM_FIELD;
                    $scopeableKey = str_replace('custom_field_', '', $scopeableKey);
                } elseif (in_array($scopeableKey, array_keys(PipelineScopeResolverService::HIBARR_FIELDS), true)) {
                    $scopeableType = \App\Models\PipelineFieldScope::TYPE_HIBARR_FIELD;
                } else {
                    $scopeableType = \App\Models\PipelineFieldScope::TYPE_NATIVE_FIELD;
                }

                $rows[] = [
                    'company_id' => company()->id,
                    'scopeable_type' => $scopeableType,
                    'scopeable_key' => $scopeableKey,
                    'model' => $model,
                    'pipeline_id' => $pipeline->id,
                    'pipeline_stage_id' => $stageId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        DB::transaction(function () use ($pipeline, $rows) {
            \App\Models\PipelineFieldScope::where('pipeline_id', $pipeline->id)->delete();

            if (!empty($rows)) {
                \App\Models\PipelineFieldScope::insert($rows);
            }
        });
    }
}
