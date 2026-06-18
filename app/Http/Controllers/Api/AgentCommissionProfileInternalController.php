<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AgentCommissionProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AgentCommissionProfileInternalController extends Controller
{
    public function __construct(
        protected AgentCommissionProfileService $profileService
    ) {}

    public function show(Request $request, int $agentId): JsonResponse
    {
        if (!$this->featureEnabled()) {
            abort(404);
        }

        $companyId = (int) $request->header('X-COMPANY-ID');
        $perPage = min((int) $request->input('audit_per_page', 15), 100);

        return response()->json([
            'status' => 'success',
            'data' => $this->profileService->getProfile($agentId, $companyId, $perPage),
        ]);
    }

    public function update(Request $request, int $agentId): JsonResponse
    {
        if (!$this->featureEnabled()) {
            abort(404);
        }

        $companyId = (int) $request->header('X-COMPANY-ID');

        $validated = $request->validate([
            'custom_direct_rate' => 'nullable|numeric|min:0|max:100',
            'custom_override_rate' => 'nullable|numeric|min:0|max:100',
            'reason' => 'nullable|string|max:1000',
        ]);

        $result = $this->profileService->updateProfile(
            $agentId,
            $companyId,
            null,
            $validated
        );

        if (!empty($result['errors'])) {
            return response()->json([
                'status' => 'fail',
                'message' => 'Commission rate validation failed.',
                'errors' => $result['errors'],
            ], 422);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Commission profile updated successfully.',
            'data' => $result['profile'],
        ]);
    }

    protected function featureEnabled(): bool
    {
        return (bool) config('features.sales.per-agent-commission-override', false);
    }
}
