<?php

namespace App\Services;

use App\Models\CustomFieldCategory;
use App\Models\CustomFieldCategoryScope;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Models\PipelineFieldScope;
use App\Models\PipelineStage;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PipelineScopeResolverService
{
    /**
     * Native deal fields that can be scoped per pipeline/stage.
     *
     * @var array<string, string>
     */
    public const DEAL_NATIVE_FIELDS = [
        'name' => 'Deal Name',
        'close_date' => 'Close Date',
        'value' => 'Value',
        'category_id' => 'Category',
        'agent_id' => 'Agent',
        'note' => 'Note',
        'next_follow_up' => 'Next Follow Up',
    ];

    /**
     * Lead (contact) fields shown on deal UI.
     *
     * @var array<string, string>
     */
    public const LEAD_NATIVE_FIELDS = [
        'client_name' => 'Contact Name',
        'client_email' => 'Contact Email',
        'mobile' => 'Contact Mobile',
    ];

    /**
     * Hibarr deal fields.
     *
     * @var array<string, string>
     */
    public const HIBARR_FIELDS = [
        'interested_in' => 'Interested In',
        'motivation' => 'Motivation',
        'purchase_timeline' => 'Purchase Timeline',
        'budget_range' => 'Budget Range',
        'message' => 'Message',
        'strategy_meeting_booked' => 'Strategy Meeting Booked',
        'downpayment_paid' => 'Downpayment Paid',
        'inspection_trip_date' => 'Inspection Trip Date',
        'deposit_confirmation' => 'Deposit Confirmation',
        'reservation_agreement' => 'Reservation Agreement',
        'sales_contract' => 'Sales Contract',
    ];

    /**
     * Resolve category IDs for a pipeline/stage context.
     * Returns null when no scopes are configured (show all — backward compatible).
     *
     * @return array<int>|null
     */
    public function resolveCategoryIds(?int $pipelineId, ?int $stageId, ?int $companyId = null): ?array
    {
        if (!$pipelineId) {
            return null;
        }

        $companyId = $companyId ?? company()?->id;

        $scopesQuery = CustomFieldCategoryScope::query()
            ->where('pipeline_id', $pipelineId);

        if ($companyId) {
            $scopesQuery->where('company_id', $companyId);
        }

        $scopes = $scopesQuery->get();

        if ($scopes->isEmpty()) {
            return null;
        }

        $stageAssignedCategoryIds = $scopes->whereNotNull('pipeline_stage_id')
            ->pluck('category_id')
            ->unique();

        $pipelineWide = $scopes->whereNull('pipeline_stage_id')
            ->pluck('category_id')
            ->reject(fn ($id) => $stageAssignedCategoryIds->contains($id));

        $stageIds = $this->getStageIdsUpToAndIncluding($pipelineId, $stageId);

        if ($stageId) {
            $currentStageCategoryIds = $scopes
                ->where('pipeline_stage_id', $stageId)
                ->pluck('category_id');

            if ($currentStageCategoryIds->isNotEmpty()) {
                $previousStageIds = array_values(array_filter(
                    $stageIds,
                    fn ($id) => (int) $id !== (int) $stageId
                ));

                $previousCategoryIds = !empty($previousStageIds)
                    ? $scopes->whereIn('pipeline_stage_id', $previousStageIds)->pluck('category_id')
                    : collect();

                // Current stage has its own scoped categories: those (plus earlier
                // stages) fully take over from pipeline-wide for this view.
                return $previousCategoryIds
                    ->merge($currentStageCategoryIds)
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        $stageSpecific = !empty($stageIds)
            ? $scopes->whereIn('pipeline_stage_id', $stageIds)->pluck('category_id')
            : collect();

        return $pipelineWide->merge($stageSpecific)->unique()->values()->all();
    }

    /**
     * All category IDs configured for a pipeline (pipeline-wide + every stage).
     * Returns null when no scopes exist for the pipeline.
     *
     * @return array<int>|null
     */
    public function resolveAllCategoryIds(?int $pipelineId, ?int $companyId = null): ?array
    {
        if (!$pipelineId) {
            return null;
        }

        $companyId = $companyId ?? company()?->id;

        $scopesQuery = CustomFieldCategoryScope::query()
            ->where('pipeline_id', $pipelineId);

        if ($companyId) {
            $scopesQuery->where('company_id', $companyId);
        }

        $scopes = $scopesQuery->get();

        if ($scopes->isEmpty()) {
            return null;
        }

        $stageAssignedCategoryIds = $scopes->whereNotNull('pipeline_stage_id')
            ->pluck('category_id')
            ->unique();

        $pipelineWide = $scopes->whereNull('pipeline_stage_id')
            ->pluck('category_id')
            ->reject(fn ($id) => $stageAssignedCategoryIds->contains($id));

        $stageSpecific = $scopes->whereNotNull('pipeline_stage_id')->pluck('category_id');

        return $pipelineWide->merge($stageSpecific)->unique()->values()->all();
    }

    /**
     * Stage IDs from the start of the pipeline through the current stage (inclusive).
     * Uses stage priority ordering within the pipeline.
     *
     * @return array<int>
     */
    public function getStageIdsUpToAndIncluding(?int $pipelineId, ?int $stageId): array
    {
        if (!$pipelineId || !$stageId) {
            return $stageId ? [(int) $stageId] : [];
        }

        $pipelineStages = PipelineStage::query()
            ->where('lead_pipeline_id', $pipelineId)
            ->orderBy('priority')
            ->orderBy('id')
            ->get(['id']);

        if ($pipelineStages->isEmpty()) {
            return [(int) $stageId];
        }

        $currentIndex = $pipelineStages->search(
            fn ($stage) => (int) $stage->id === (int) $stageId
        );

        if ($currentIndex === false) {
            return [(int) $stageId];
        }

        return $pipelineStages
            ->slice(0, $currentIndex + 1)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    /**
     * Resolve scoped custom field categories with fields loaded.
     */
    public function resolveCategories(?int $pipelineId, ?int $stageId, ?int $companyId = null): Collection
    {
        $categoryIds = $this->resolveCategoryIds($pipelineId, $stageId, $companyId);

        $query = CustomFieldCategory::query()
            ->where('company_id', $companyId ?? company()->id)
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc');

        if ($categoryIds !== null) {
            if (empty($categoryIds)) {
                return collect();
            }
            $query->whereIn('id', $categoryIds);
        }

        return $query->get();
    }

    /**
     * Resolve categories for a deal instance.
     */
    public function resolveCategoriesForDeal(Deal $deal): Collection
    {
        return $this->resolveCategories(
            $deal->lead_pipeline_id,
            $deal->pipeline_stage_id,
            $deal->company_id
        );
    }

    /**
     * Build category scope map for frontend: pipeline -> { pipelineWide, byStage }.
     *
     * @return array<string, array{pipelineWide: int[], byStage: array<string, int[]>}>
     */
    public function buildCategoryScopeMapForCompany(?int $companyId = null): array
    {
        $companyId = $companyId ?? company()->id;

        $scopes = CustomFieldCategoryScope::query()
            ->where('company_id', $companyId)
            ->get();

        $map = [];

        foreach ($scopes as $scope) {
            $pipelineKey = (string) $scope->pipeline_id;

            if (!isset($map[$pipelineKey])) {
                $map[$pipelineKey] = [
                    'pipelineWide' => [],
                    'byStage' => [],
                ];
            }

            if ($scope->pipeline_stage_id === null) {
                $map[$pipelineKey]['pipelineWide'][] = (int) $scope->category_id;
            } else {
                $stageKey = (string) $scope->pipeline_stage_id;
                $map[$pipelineKey]['byStage'][$stageKey][] = (int) $scope->category_id;
            }
        }

        return $map;
    }

    /**
     * Build field scope map for frontend: pipeline -> model -> { pipelineWide, byStage }.
     *
     * @return array<string, array<string, array{pipelineWide: string[], byStage: array<string, string[]>}>>
     */
    public function buildFieldScopeMapForCompany(?int $companyId = null): array
    {
        $companyId = $companyId ?? company()->id;

        $scopes = PipelineFieldScope::query()
            ->where('company_id', $companyId)
            ->get();

        $map = [];

        foreach ($scopes as $scope) {
            $pipelineKey = (string) $scope->pipeline_id;
            $modelKey = $scope->model;
            $fieldKey = $scope->scopeable_type . ':' . $scope->scopeable_key;

            if (!isset($map[$pipelineKey][$modelKey])) {
                $map[$pipelineKey][$modelKey] = [
                    'pipelineWide' => [],
                    'byStage' => [],
                ];
            }

            if ($scope->pipeline_stage_id === null) {
                $map[$pipelineKey][$modelKey]['pipelineWide'][] = $fieldKey;
            } else {
                $stageKey = (string) $scope->pipeline_stage_id;
                $map[$pipelineKey][$modelKey]['byStage'][$stageKey][] = $fieldKey;
            }
        }

        return $map;
    }

    /**
     * Resolve allowed category IDs for frontend given pipeline + stage.
     *
     * @return array<int>|null null = show all (backward compatible)
     */
    public function resolveCategoryIdsForFrontend(?int $pipelineId, ?int $stageId, ?int $companyId = null): ?array
    {
        return $this->resolveCategoryIds($pipelineId, $stageId, $companyId);
    }

    /**
     * Check whether field scopes exist for a pipeline.
     */
    public function hasFieldScopes(?int $pipelineId, ?string $model = null, ?int $companyId = null): bool
    {
        if (!$pipelineId) {
            return false;
        }

        $query = PipelineFieldScope::query()
            ->where('pipeline_id', $pipelineId)
            ->when($companyId ?? company()?->id, fn ($q, $id) => $q->where('company_id', $id));

        if ($model !== null) {
            $query->where('model', $model);
        }

        return $query->exists();
    }

    /**
     * Resolve visible field keys for a model in pipeline/stage context.
     * Returns null when no scopes configured (show all).
     *
     * @return array<string>|null keys in format "type:key" e.g. "native_field:name", "hibarr_field:budget_range", "custom_field:42"
     */
    public function resolveFieldKeys(?int $pipelineId, ?int $stageId, string $model, ?int $companyId = null): ?array
    {
        if (!$pipelineId) {
            return null;
        }

        $companyId = $companyId ?? company()?->id;

        $scopesQuery = PipelineFieldScope::query()
            ->where('pipeline_id', $pipelineId)
            ->where('model', $model);

        if ($companyId) {
            $scopesQuery->where('company_id', $companyId);
        }

        $scopes = $scopesQuery->get();

        if ($scopes->isEmpty()) {
            return null;
        }

        $stageAssignedKeys = $scopes->whereNotNull('pipeline_stage_id')
            ->map(fn ($scope) => $scope->scopeable_type . ':' . $scope->scopeable_key)
            ->unique();

        $pipelineWide = $scopes->whereNull('pipeline_stage_id')
            ->reject(fn ($scope) => $stageAssignedKeys->contains(
                $scope->scopeable_type . ':' . $scope->scopeable_key
            ));

        $stageIds = $this->getStageIdsUpToAndIncluding($pipelineId, $stageId);

        if ($stageId) {
            $currentStageScopes = $scopes->where('pipeline_stage_id', $stageId);

            if ($currentStageScopes->isNotEmpty()) {
                $previousStageIds = array_values(array_filter(
                    $stageIds,
                    fn ($id) => (int) $id !== (int) $stageId
                ));

                $previousScopes = !empty($previousStageIds)
                    ? $scopes->whereIn('pipeline_stage_id', $previousStageIds)
                    : collect();

                // Current stage has its own scoped fields: those (plus earlier
                // stages) fully take over from pipeline-wide for this view.
                return $previousScopes->merge($currentStageScopes)
                    ->map(fn ($scope) => $scope->scopeable_type . ':' . $scope->scopeable_key)
                    ->unique()
                    ->values()
                    ->all();
            }
        }

        $stageSpecific = !empty($stageIds)
            ? $scopes->whereIn('pipeline_stage_id', $stageIds)
            : collect();

        return $pipelineWide->merge($stageSpecific)
            ->map(fn ($scope) => $scope->scopeable_type . ':' . $scope->scopeable_key)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * All field keys configured for a pipeline/model (pipeline-wide + every stage).
     *
     * @return array<string>|null
     */
    public function resolveAllFieldKeys(?int $pipelineId, string $model, ?int $companyId = null): ?array
    {
        if (!$pipelineId) {
            return null;
        }

        $companyId = $companyId ?? company()?->id;

        $scopesQuery = PipelineFieldScope::query()
            ->where('pipeline_id', $pipelineId)
            ->where('model', $model);

        if ($companyId) {
            $scopesQuery->where('company_id', $companyId);
        }

        $scopes = $scopesQuery->get();

        if ($scopes->isEmpty()) {
            return null;
        }

        $stageAssignedKeys = $scopes->whereNotNull('pipeline_stage_id')
            ->map(fn ($scope) => $scope->scopeable_type . ':' . $scope->scopeable_key)
            ->unique();

        $pipelineWide = $scopes->whereNull('pipeline_stage_id')
            ->reject(fn ($scope) => $stageAssignedKeys->contains(
                $scope->scopeable_type . ':' . $scope->scopeable_key
            ));

        $stageSpecific = $scopes->whereNotNull('pipeline_stage_id');

        return $pipelineWide->merge($stageSpecific)
            ->map(fn ($scope) => $scope->scopeable_type . ':' . $scope->scopeable_key)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Check if a specific field is visible in the current pipeline/stage context.
     */
    public function isFieldVisible(
        ?int $pipelineId,
        ?int $stageId,
        string $model,
        string $scopeableType,
        string $scopeableKey,
        ?int $companyId = null
    ): bool {
        $keys = $this->resolveFieldKeys($pipelineId, $stageId, $model, $companyId);

        if ($keys === null) {
            return true;
        }

        return in_array($scopeableType . ':' . $scopeableKey, $keys, true);
    }

    /**
     * Sync category scopes for a pipeline from admin form data.
     *
     * @param array<string, array<int|string>> $categoryScopes keys: '__pipeline__' or stage id strings
     */
    public function syncCategoryScopes(LeadPipeline $pipeline, array $categoryScopes, ?int $companyId = null): void
    {
        $companyId = $companyId ?? company()->id;

        $validStageIds = $pipeline->stages()->pluck('id')->map(fn ($stageId) => (int) $stageId)->all();

        $rows = [];

        foreach ($categoryScopes as $stageKey => $categoryIds) {
            if (!is_array($categoryIds)) {
                continue;
            }

            if ($stageKey !== '__pipeline__' && !in_array((int) $stageKey, $validStageIds, true)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'category_scopes' => __('validation.exists', ['attribute' => 'category_scopes']),
                ]);
            }

            $stageId = $stageKey === '__pipeline__' ? null : (int) $stageKey;

            foreach (array_unique(array_filter($categoryIds)) as $categoryId) {
                $rows[] = [
                    'company_id' => $companyId,
                    'category_id' => (int) $categoryId,
                    'pipeline_id' => $pipeline->id,
                    'pipeline_stage_id' => $stageId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        \Illuminate\Support\Facades\DB::transaction(function () use ($pipeline, $rows) {
            CustomFieldCategoryScope::where('pipeline_id', $pipeline->id)->delete();

            if (!empty($rows)) {
                CustomFieldCategoryScope::insert($rows);
            }
        });
    }

    /**
     * Get category scopes grouped for pipeline edit form.
     *
     * @return array{__pipeline__: int[], stages: array<int, int[]>}
     */
    public function getCategoryScopesForPipeline(LeadPipeline $pipeline): array
    {
        $scopes = $pipeline->customFieldCategoryScopes;

        $result = [
            '__pipeline__' => [],
            'stages' => [],
        ];

        foreach ($scopes as $scope) {
            if ($scope->pipeline_stage_id === null) {
                $result['__pipeline__'][] = (int) $scope->category_id;
            } else {
                $result['stages'][(int) $scope->pipeline_stage_id][] = (int) $scope->category_id;
            }
        }

        return $result;
    }

    /**
     * Deal gathering steps payload.
     */
    public function getStepsForPipeline(?int $pipelineId, ?int $stageId = null): array
    {
        $group = \App\Models\CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();

        if (!$group) {
            return [];
        }

        $categoryIds = $this->resolveCategoryIds($pipelineId, $stageId);

        $categoriesQuery = CustomFieldCategory::where('custom_field_group_id', $group->id)
            ->where('company_id', company()->id)
            ->orderBy(DB::raw('`order`'), 'asc')
            ->orderBy('id', 'asc');

        if ($categoryIds !== null) {
            if (empty($categoryIds)) {
                return [];
            }
            $categoriesQuery->whereIn('id', $categoryIds);
        }

        $categories = $categoriesQuery
            ->with(['customFields' => function ($q) {
                $q->orderBy('display_order')
                    ->with([
                        'showRuleSet' => function ($query) {
                            $query->with([
                                'groups' => function ($groupQuery) {
                                    $groupQuery->where('enabled', true)
                                        ->orderBy('id')
                                        ->with('criteria.referenceField');
                                },
                                'group.criteria.referenceField',
                            ]);
                        },
                    ]);
            }])
            ->get();

        return $categories
            ->filter(fn ($category) => $category->customFields->count() > 0)
            ->map(function ($category) {
                return [
                    'id' => $category->id,
                    'title' => $category->name,
                    'fields' => $category->customFields,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * All scopeable fields grouped by model for admin UI.
     *
     * @return array<string, array<string, string>>
     */
    public function getScopeableFieldsCatalog(): array
    {
        $catalog = [
            Deal::CUSTOM_FIELD_MODEL => array_merge(self::DEAL_NATIVE_FIELDS, self::HIBARR_FIELDS),
            Lead::CUSTOM_FIELD_MODEL => self::LEAD_NATIVE_FIELDS,
        ];

        $dealGroup = \App\Models\CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        if ($dealGroup) {
            $customFields = \App\Models\CustomField::where('custom_field_group_id', $dealGroup->id)
                ->where('company_id', company()->id)
                ->orderBy('display_order')
                ->get();

            foreach ($customFields as $field) {
                $catalog[Deal::CUSTOM_FIELD_MODEL]['custom_field_' . $field->id] = $field->label;
            }
        }

        $leadGroup = \App\Models\CustomFieldGroup::where('model', Lead::CUSTOM_FIELD_MODEL)->first();
        if ($leadGroup) {
            $leadCustomFields = \App\Models\CustomField::where('custom_field_group_id', $leadGroup->id)
                ->where('company_id', company()->id)
                ->orderBy('display_order')
                ->get();

            foreach ($leadCustomFields as $field) {
                $catalog[Lead::CUSTOM_FIELD_MODEL]['custom_field_' . $field->id] = $field->label;
            }
        }

        return $catalog;
    }
}
