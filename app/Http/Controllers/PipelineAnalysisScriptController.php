<?php

namespace App\Http\Controllers;

use App\Models\CustomField;
use App\Models\CustomFieldCategory;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadPipeline;
use App\Models\PipelineAnalysisScript;
use App\Models\PipelineAnalysisScriptItem;
use App\Services\PipelineScopeResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class PipelineAnalysisScriptController extends Controller
{
    public function __construct(protected PipelineScopeResolverService $scopeResolver)
    {
    }

    /**
     * Settings page shell for the analysis script builder — the only action here
     * gated by permission; show/upsert/pipelines/categories are unchanged from
     * their pre-existing (ungated) behavior.
     */
    public function builder(): InertiaResponse
    {
        abort_403(!(user()->permission('manage_lead_setting') == 'all' && in_array('leads', user()->modules)));

        return Inertia::render('Settings/AnalysisScriptBuilder', [
            'pageTitle' => __('modules.deal.analysisScript'),
        ]);
    }

    /** Pipeline picker for the builder. */
    public function pipelines(): JsonResponse
    {
        $pipelines = LeadPipeline::where('company_id', company()->id)
            ->orderBy('default', 'desc')
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['pipelines' => $pipelines]);
    }

    /**
     * Custom field categories actually linked/scoped to this pipeline (pipeline-wide
     * or on any of its stages) — same computation as edit-pipeline-modal.blade.php's
     * "Analysis Script" add-step dropdown, via LeadPipelineSettingController::edit().
     */
    public function categories(int $pipelineId): JsonResponse
    {
        $pipeline = LeadPipeline::with(['customFieldCategoryScopes', 'stages'])
            ->where('company_id', company()->id)
            ->findOrFail($pipelineId);

        $scopes = $this->scopeResolver->getCategoryScopesForPipeline($pipeline);
        $linkedCategoryIds = collect($scopes['__pipeline__'] ?? [])
            ->merge(collect($scopes['stages'] ?? [])->flatten())
            ->map(fn ($id) => (int) $id)
            ->unique();

        $dealCustomFieldGroup = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)->first();
        $categories = collect();
        if ($dealCustomFieldGroup && $linkedCategoryIds->isNotEmpty()) {
            $categories = CustomFieldCategory::where('custom_field_group_id', $dealCustomFieldGroup->id)
                ->where('company_id', company()->id)
                ->whereIn('id', $linkedCategoryIds)
                ->orderBy(DB::raw('`order`'), 'asc')
                ->orderBy('id', 'asc')
                ->get(['id', 'name']);
        }

        return response()->json(['categories' => $categories]);
    }

    /**
     * Every deal + lead custom field, for the builder's drag palette. Not pipeline
     * scoped — hand-built sections aren't scope-driven, so any field is fair game
     * (unlike categories(), which feeds the pipeline-scoped category-section option).
     */
    public function paletteFields(): JsonResponse
    {
        return response()->json([
            'deal' => $this->customFieldsForModel(Deal::CUSTOM_FIELD_MODEL),
            'lead' => $this->customFieldsForModel(Lead::CUSTOM_FIELD_MODEL),
        ]);
    }

    /** @return \Illuminate\Support\Collection<int, array<string, mixed>> */
    private function customFieldsForModel(string $model): \Illuminate\Support\Collection
    {
        $group = CustomFieldGroup::where('model', $model)->first();

        if (! $group) {
            return collect();
        }

        // Excluding `file` only — matching what the modal actually renders (see
        // AnalysisCustomFieldForm::scopedFields). The `visible` column is an
        // export-scope flag here, not a render flag, so it is deliberately not used.
        //
        // company_id is already enforced by CustomField's HasCompany global scope;
        // it is repeated explicitly because this endpoint is reachable by any
        // authenticated user and the tenant boundary should be visible in the query.
        return CustomField::where('custom_field_group_id', $group->id)
            ->where('company_id', company()->id)
            ->where('type', '!=', 'file')
            ->with('customFieldCategory:id,name')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get()
            ->map(fn (CustomField $f) => [
                'id'            => $f->id,
                'label'         => $f->label,
                'type'          => $f->type,
                'category_id'   => $f->custom_field_category_id,
                'category_name' => $f->customFieldCategory?->name,
            ])
            ->values();
    }

    public function show(int $pipelineId): JsonResponse
    {
        $script = PipelineAnalysisScript::with('items')
            ->where('pipeline_id', $pipelineId)
            ->where('company_id', company()->id)
            ->first();

        return response()->json([
            'items' => $script ? $script->items->values() : [],
        ]);
    }

    public function upsert(Request $request, int $id): JsonResponse
    {
        // LeadPipeline carries the HasCompany global scope, so this 404s for a
        // pipeline belonging to another company rather than letting the write through.
        LeadPipeline::findOrFail($id);

        $request->validate([
            'items'                => ['array'],
            'items.*.type'         => ['required', 'in:custom_field_category,native_field,hibarr_field,lead_field,question,instruction,section,deal_custom_field,lead_custom_field'],
            'items.*.item_key'     => ['required', 'string', 'max:255'],
            'items.*.label_override' => ['nullable', 'string', 'max:255'],
            'items.*.guide_text'   => ['nullable', 'string'],
            'items.*.is_required'  => ['boolean'],
        ]);

        $script = PipelineAnalysisScript::firstOrCreate(
            ['pipeline_id' => $id],
            ['company_id'  => company()->id],
        );

        $items = collect($request->input('items', []))
            ->values()
            ->map(fn ($item, $index) => [
                'analysis_script_id' => $script->id,
                'type'               => $item['type'],
                'item_key'           => $item['item_key'],
                'label_override'     => $item['label_override'] ?? null,
                'guide_text'         => $item['guide_text'] ?? null,
                'is_required'        => (bool) ($item['is_required'] ?? false),
                'position'           => $index,
            ])
            ->all();

        // Replace-in-place: without the transaction a failed insert would leave the
        // pipeline with no steps at all.
        DB::transaction(function () use ($script, $items) {
            $script->items()->delete();

            if ($items) {
                PipelineAnalysisScriptItem::insert($items);
            }
        });

        return response()->json(['status' => 'success']);
    }
}
