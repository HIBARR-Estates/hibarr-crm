<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\LevelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentLevelInternalController extends Controller
{
    public function __construct(
        protected LevelService $levelService
    ) {}

    public function update(Request $request, int $agentId): JsonResponse
    {
        $companyId = (int) $request->header('X-COMPANY-ID');

        $validated = $request->validate([
            'levelId' => 'nullable|integer|exists:mlm_levels,id',
            'level_id' => 'nullable|integer|exists:mlm_levels,id',
        ]);

        $levelId = $validated['levelId'] ?? $validated['level_id'] ?? null;

        if ($levelId === null) {
            return response()->json([
                'status' => 'fail',
                'message' => 'The levelId field is required.',
                'errors' => ['levelId' => ['The levelId field is required.']],
            ], 422);
        }

        $level = MlmLevel::where('company_id', $companyId)->findOrFail($levelId);

        if ($level->is_hidden) {
            return response()->json([
                'error' => 'LEVEL_HIDDEN',
                'message' => 'Hidden levels cannot be assigned through normal promotion flows.',
            ], 422);
        }

        $agent = LeadAgent::where('company_id', $companyId)->findOrFail($agentId);

        $history = $this->levelService->assignLevel(
            $agent,
            $level,
            assignedBy: null,
            systemAssigned: false
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Agent level updated successfully.',
            'data' => [
                'agentId' => $agent->id,
                'levelId' => $level->id,
                'levelName' => $level->name,
                'assignedAt' => $history->assigned_at?->toIso8601String(),
            ],
        ]);
    }
}
