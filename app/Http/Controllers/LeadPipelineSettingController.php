<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\StoreLeadPipeline;
use App\Http\Requests\LeadSetting\UpdateLeadPipeline;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldCategoryScope;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\LeadPipeline;
use App\Models\PackagePipeline;
use App\Models\PackageRoutingTrigger;
use App\Models\PipelineFieldScope;
use App\Models\PipelineStage;
use App\Services\PipelineScopeResolverService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
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
        $this->pipelineFieldScopes = PipelineFieldScope::where('pipeline_id', $this->pipeline->id)->get();
        $this->pipelineFieldScopeMap = $this->buildFieldScopeMap($this->pipelineFieldScopes);

        // The analysis script is edited on its own settings page now, so this view
        // no longer needs to load it.

        return view('lead-settings.edit-pipeline-modal', $this->data);
    }

    /**
     * JSON editor payload for the Deal Settings pipeline-management tab.
     */
    public function show($id)
    {
        $payload = $this->pipelineEditorPayload($id);
        unset($payload['pipelineModel']);

        return response()->json($payload);
    }

    public function update(UpdateLeadPipeline $request, $id)
    {
        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();

        $validated = $request->validated();
        $categoryScopes = $validated['category_scopes'] ?? [];

        if (empty($categoryScopes) && isset($validated['category_ids'])) {
            $categoryScopes = [
                '__pipeline__' => $validated['category_ids'],
            ];
        }

        $fieldScopes = $validated['field_scopes'] ?? $request->input('field_scopes', []);
        $fieldScopes = is_array($fieldScopes) ? $fieldScopes : [];

        $hideFromNav = array_key_exists('hidden_from_nav', $validated)
            ? (bool) $validated['hidden_from_nav']
            : null;
        $hideFromSystem = array_key_exists('hidden_from_system', $validated)
            ? (bool) $validated['hidden_from_system']
            : null;

        if ($pipeline->default == 1) {
            if ($hideFromNav === true) {
                return Reply::error(__('modules.deal.pipelineDefaultNavVisibilityError'));
            }
            if ($hideFromSystem === true) {
                return Reply::error(__('modules.deal.pipelineDefaultSystemVisibilityError'));
            }
        }

        DB::transaction(function () use ($request, $pipeline, $categoryScopes, $fieldScopes, $hideFromNav, $hideFromSystem) {
            $pipeline->name = $request->name;
            $pipeline->label_color = $request->label_color;
            $pipeline->hide_all_categories = $request->boolean('hide_all_categories');
            if ($hideFromNav !== null) {
                $pipeline->hidden_from_nav = $hideFromNav;
            }
            if ($hideFromSystem !== null) {
                $pipeline->hidden_from_system = $hideFromSystem;
            }
            $pipeline->save();

            $this->scopeResolver->syncCategoryScopes($pipeline, $categoryScopes);
            $this->syncFieldScopes($pipeline, $fieldScopes);
        });

        return Reply::success(__('messages.updateSuccess'));
    }

    public function statusUpdate($id)
    {
        // Include visibility flags so promoting a pipeline to default also un-hides it.
        $allLeadSPipelines = LeadPipeline::select('id', 'default', 'hidden_from_nav', 'hidden_from_system')->get();

        foreach ($allLeadSPipelines as $pipeline) {
            if ($pipeline->id == $id) {
                $pipeline->default = '1';
                $pipeline->hidden_from_nav = false;
                $pipeline->hidden_from_system = false;
            } else {
                $pipeline->default = '0';
            }

            $pipeline->save();
        }

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateNavVisibility(Request $request, $id)
    {
        abort_unless(FeatureFlags::enabled('crm.pipeline-nav-visibility'), 404);

        $request->validate([
            'hidden_from_nav' => 'required|boolean',
        ]);

        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($pipeline->default == 1 && $request->boolean('hidden_from_nav')) {
            return Reply::error(__('modules.deal.pipelineDefaultNavVisibilityError'));
        }

        $pipeline->hidden_from_nav = $request->boolean('hidden_from_nav');
        $pipeline->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function updateSystemVisibility(Request $request, $id)
    {
        $request->validate([
            'hidden_from_system' => 'required|boolean',
        ]);

        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();

        if ($pipeline->default == 1 && $request->boolean('hidden_from_system')) {
            return Reply::error(__('modules.deal.pipelineDefaultSystemVisibilityError'));
        }

        $pipeline->hidden_from_system = $request->boolean('hidden_from_system');
        $pipeline->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    /**
     * Shared payload for the Blade edit modal and the React Deal Settings tab.
     *
     * @return array{
     *     pipeline: array,
     *     stages: array,
     *     categories: array,
     *     category_scopes: array,
     *     field_scopes: array,
     *     scopeable_fields: array,
     *     pipelineModel: LeadPipeline
     * }
     */
    protected function pipelineEditorPayload(int|string $id): array
    {
        $pipeline = LeadPipeline::with(['customFieldCategoryScopes', 'stages'])
            ->where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();

        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $categories = collect();
        if ($dealCustomFieldGroup) {
            $categories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get(['id', 'name']);
        }

        $fieldScopes = PipelineFieldScope::where('pipeline_id', $pipeline->id)->get();
        $catalog = $this->scopeResolver->getScopeableFieldsCatalog();

        $fieldOptions = [];
        foreach ($catalog as $model => $fields) {
            $items = [];
            foreach ($fields as $fieldKey => $fieldLabel) {
                $fieldType = str_starts_with($fieldKey, 'custom_field_')
                    ? PipelineFieldScope::TYPE_CUSTOM_FIELD
                    : (array_key_exists($fieldKey, PipelineScopeResolverService::HIBARR_FIELDS)
                        ? PipelineFieldScope::TYPE_HIBARR_FIELD
                        : PipelineFieldScope::TYPE_NATIVE_FIELD);
                $items[] = [
                    'value' => $model . '|' . $fieldType . '|' . $fieldKey,
                    'label' => $fieldLabel,
                ];
            }
            $fieldOptions[] = [
                'model' => $model,
                'label' => class_basename($model),
                'items' => $items,
            ];
        }

        return [
            'pipeline' => [
                'id' => (int) $pipeline->id,
                'name' => $pipeline->name,
                'label_color' => $pipeline->label_color,
                'default' => (bool) $pipeline->default,
                'hidden_from_nav' => (bool) $pipeline->hidden_from_nav,
                'hidden_from_system' => (bool) $pipeline->hidden_from_system,
                'hide_all_categories' => (bool) $pipeline->hide_all_categories,
            ],
            'stages' => $pipeline->stages->map(fn (PipelineStage $stage) => [
                'id' => (int) $stage->id,
                'name' => $stage->name,
                'label_color' => $stage->label_color,
                'priority' => (int) $stage->priority,
                'default' => (bool) $stage->default,
            ])->values()->all(),
            'categories' => $categories->map(fn ($c) => [
                'id' => (int) $c->id,
                'name' => $c->name,
            ])->values()->all(),
            'category_scopes' => $this->scopeResolver->getCategoryScopesForPipeline($pipeline),
            'field_scopes' => $this->buildFieldScopeMap($fieldScopes),
            'scopeable_fields' => $catalog,
            'field_options' => $fieldOptions,
            'pipelineModel' => $pipeline,
        ];
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        $pipeline = LeadPipeline::where('company_id', company()->id)
            ->where('id', $id)
            ->firstOrFail();

        DB::transaction(function () use ($pipeline) {
            Deal::where('lead_pipeline_id', $pipeline->id)->where('is_locked', false)->delete();
            PipelineStage::where('lead_pipeline_id', $pipeline->id)->delete();

            CustomFieldCategoryScope::where('pipeline_id', $pipeline->id)->delete();
            PipelineFieldScope::where('pipeline_id', $pipeline->id)->delete();

            $packageIds = PackagePipeline::where('pipeline_id', $pipeline->id)->pluck('package_id');
            if ($packageIds->isNotEmpty()) {
                PackageRoutingTrigger::whereIn('package_id', $packageIds)->delete();
            }

            PackagePipeline::where('pipeline_id', $pipeline->id)->delete();

            $pipeline->delete();
        });

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

            // syncFieldScopes() re-derives the real type from the key suffix, so this
            // segment is purely informational — keep it truthful rather than hardcoded.
            $key = $scope->model . '|' . $scope->scopeable_type . '|' . $displayKey;

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
