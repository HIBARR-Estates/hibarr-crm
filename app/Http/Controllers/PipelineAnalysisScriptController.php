<?php

namespace App\Http\Controllers;

use App\Models\PipelineAnalysisScript;
use App\Models\PipelineAnalysisScriptItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $script->items()->delete();

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

        if ($items) {
            PipelineAnalysisScriptItem::insert($items);
        }

        return response()->json(['status' => 'success']);
    }
}
