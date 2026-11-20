<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AgentCommissionProfileService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AgentCommissionProfileInternalController extends Controller
{
    public function __construct(
        protected AgentCommissionProfileService $profileService
    ) {}

    public function show(Request $request, int $agentId): JsonResponse
    {
        if (! $this->featureEnabled()) {
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
        if (! $this->featureEnabled()) {
            abort(404);
        }

        $companyId = (int) $request->header('X-COMPANY-ID');

        $rules = [
            'reason' => 'nullable|string|max:1000',
            'changed_by_user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(
                    fn ($query) => $query->where('company_id', $companyId)
                ),
            ],
        ];

        // Each field is validated only while its own flag is on, so a request
        // for one feature is never rejected over the other's field.
        if ($this->overrideEnabled()) {
            $rules['custom_commission_rate'] = 'nullable|numeric|min:0|max:100';
        }

        if ($this->referralEnabled()) {
            $rules['referral_pool_rate'] = 'nullable|numeric|min:0|max:100';
        }

        $validated = $request->validate($rules);

        $result = $this->profileService->updateProfile(
            $agentId,
            $companyId,
            $validated['changed_by_user_id'] ?? null,
            $validated
        );

        if (! empty($result['errors'])) {
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

    /** The profile API serves whichever of its two features is switched on. */
    protected function featureEnabled(): bool
    {
        return $this->overrideEnabled() || $this->referralEnabled();
    }

    protected function overrideEnabled(): bool
    {
        return FeatureFlags::enabled('sales.per-agent-commission-override');
    }

    protected function referralEnabled(): bool
    {
        return FeatureFlags::enabled('crm.partner-referral-commission');
    }
}
