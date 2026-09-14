<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\Lead;
use App\Services\OlTelephonyProxyService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class TelephonyCallController extends AccountBaseController
{
    public function __construct(
        private readonly OlTelephonyProxyService $telephonyProxyService,
    ) {
        parent::__construct();
    }

    public function store(Request $request): JsonResponse
    {
        $this->assertFeatureEnabled();

        $validated = $request->validate([
            'phone' => 'required|string|max:50',
            'entity_type' => 'required|string|in:lead,deal',
            'entity_id' => 'required|integer|min:1',
        ]);

        $entityType = $validated['entity_type'];
        $entityId = (int) $validated['entity_id'];

        if ($entityType === 'lead') {
            $lead = Lead::findOrFail($entityId);
            $this->assertCanViewLead($lead);
        } else {
            $deal = Deal::findOrFail($entityId);
            $this->assertCanViewDeal($deal);
        }

        $phoneNumber = $this->normalizePhoneNumber($validated['phone']);

        if ($phoneNumber === '') {
            return response()->json([
                'status' => 'fail',
                'message' => 'Invalid phone number.',
            ], 422);
        }

        try {
            $data = $this->telephonyProxyService->initiateCall([
                'phone_number' => $phoneNumber,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'user_id' => (int) user()->id,
            ]);
        } catch (HttpException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        }

        return response()->json([
            'status' => 'success',
            'message' => is_string($data['message'] ?? null) ? $data['message'] : 'Call initiated.',
            'data' => $data,
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('shared.3cx-calling'), 404);
    }

    private function assertCanViewLead(Lead $lead): void
    {
        abort_if((int) $lead->company_id !== (int) company()->id, 404);

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ];

        $access = PermissionService::checkAccess(user(), 'view_lead', $lead, $leadRules);

        abort_unless($access['canAccess'], 403);
    }

    private function assertCanViewDeal(Deal $deal): void
    {
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];
        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);
        abort_403(!$access['canAccess']);
    }

    private function normalizePhoneNumber(string $phone): string
    {
        $trimmed = trim($phone);

        if ($trimmed === '') {
            return '';
        }

        $hasPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';

        if ($digits === '') {
            return '';
        }

        return $hasPlus ? '+' . $digits : $digits;
    }
}
