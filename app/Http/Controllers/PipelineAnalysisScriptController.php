<?php

namespace App\Http\Controllers;

use App\Models\LeadPipeline;
use App\Models\PipelineAnalysisScript;
use App\Models\PipelineAnalysisScriptItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PipelineAnalysisScriptController extends Controller
{
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
            'items.*.type'         => ['required', 'in:custom_field_category,native_field,hibarr_field,lead_field,question,instruction'],
            'items.*.item_key'     => ['required', 'string', 'max:255'],
            'items.*.label_override' => ['nullable', 'string', 'max:255'],
            'items.*.guide_text'   => ['nullable', 'string'],
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
