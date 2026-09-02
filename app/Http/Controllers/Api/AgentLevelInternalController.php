<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Services\LevelService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AgentLevelInternalController extends Controller
{
    public function __construct(
        protected LevelService $levelService
    ) {}

    public function update(Request $request, int $agentId): JsonResponse
    {
        $companyId = (int) $request->header('X-COMPANY-ID');

        $validated = $request->validate([
            'levelId' => 'nullable|integer',
            'level_id' => 'nullable|integer',
            'changed_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(
                    fn ($query) => $query->where('company_id', $companyId)
                ),
            ],
        ]);

        $levelId = $validated['levelId'] ?? $validated['level_id'] ?? null;

        if ($levelId === null) {
            return response()->json([
                'status' => 'fail',
                'message' => 'The levelId field is required.',
                'errors' => ['levelId' => ['The levelId field is required.']],
            ], 422);
        }

        $agent = LeadAgent::where('company_id', $companyId)->find($agentId);

        if (!$agent) {
            return response()->json([
                'error' => 'AGENT_NOT_FOUND',
                'message' => 'Agent not found.',
            ], 404);
        }

        $level = MlmLevel::where('company_id', $companyId)->find($levelId);

        if (!$level) {
            return response()->json([
                'error' => 'LEVEL_NOT_FOUND',
                'message' => 'Commission level not found.',
            ], 404);
        }

        if ($level->is_hidden) {
            return response()->json([
                'error' => 'LEVEL_HIDDEN',
                'message' => 'Hidden levels cannot be assigned through normal promotion flows.',
            ], 422);
        }

        $history = $this->levelService->assignLevel(
            $agent,
            $level,
            assignedBy: $validated['changed_by_user_id'] ?? null,
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
