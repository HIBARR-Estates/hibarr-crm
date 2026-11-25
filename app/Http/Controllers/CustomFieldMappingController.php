<?php

namespace App\Http\Controllers;

use App\Services\CustomFieldMapping\CustomFieldMappingService;
use App\Services\CustomFieldMapping\InvalidMappingException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * JSON endpoints behind the "Map & migrate" dialog on the custom-fields
 * settings page. Same permission as the page itself.
 */
class CustomFieldMappingController extends AccountBaseController
{
    public function __construct(private readonly CustomFieldMappingService $mapping)
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_custom_field_setting') !== 'all');

            return $next($request);
        });
    }

    /** Dry run: reports exactly what apply would do, writes nothing. */
    public function preview(Request $request): JsonResponse
    {
        return $this->handle($request, true);
    }

    public function apply(Request $request): JsonResponse
    {
        return $this->handle($request, false);
    }

    private function handle(Request $request, bool $dryRun): JsonResponse
    {
        $data = $request->validate([
            'source_id' => ['required', 'integer'],
            'target_type' => ['required', 'in:custom,defined'],
            'target_id' => ['required_if:target_type,custom', 'nullable', 'integer'],
            'target_key' => ['required_if:target_type,defined', 'nullable', 'string', 'max:100'],
            'conflict' => ['nullable', 'in:skip,overwrite'],
            'add_missing_options' => ['nullable', 'boolean'],
            'delete_source_values' => ['nullable', 'boolean'],
            'delete_source_field' => ['nullable', 'boolean'],
            'allow_loss' => ['nullable', 'boolean'],
        ]);

        try {
            $report = $this->mapping->run($data, $dryRun);
        } catch (InvalidMappingException $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'report' => $e->report ?: null,
            ], 422);
        }

        return response()->json(['status' => 'success', 'report' => $report]);
    }
}
