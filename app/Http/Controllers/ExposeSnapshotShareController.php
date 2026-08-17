<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\ExposeSnapshot;
use App\Services\PdfExpose\ExposeSnapshotService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ExposeSnapshotShareController extends Controller
{
    public function store(Request $request, ExposeSnapshotService $snapshots): JsonResponse
    {
        if (! FeatureFlags::enabled('crm.expose-share-links')) {
            abort(404);
        }

        $validated = $request->validate([
            'entity_type' => ['required', 'string', 'in:'.implode(',', ExposeSnapshot::ENTITY_TYPES)],
            'entity_id' => ['required', 'integer', 'min:1'],
            'lead_id' => ['required', 'integer', 'min:1'],
            'unit_type_id' => ['required_if:entity_type,unit_type', 'nullable', 'integer', 'min:1'],
            'layout' => ['nullable', 'string', 'max:100'],
        ]);

        $companyId = (int) user()->company_id;
        $payload = array_merge($validated, [
            'agent_id' => (int) user()->id,
        ]);

        try {
            $result = $snapshots->mint($companyId, $payload);
        } catch (ValidationException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        }

        $token = $result['token'];
        $snapshot = $result['snapshot'];
        $shareBaseUrl = (string) config('expose.share_base_url');

        return response()->json(
            Reply::successWithData('Expose share link created', [
                'data' => [
                    'token' => $token,
                    'share_url' => $shareBaseUrl.'/'.$token,
                    'snapshot_id' => $snapshot->id,
                    'warnings' => $snapshot->warnings ?? [],
                ],
            ]),
            201
        );
    }
}
