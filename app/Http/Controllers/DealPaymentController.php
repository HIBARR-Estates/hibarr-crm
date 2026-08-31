<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Services\DealPaymentService;
use App\Services\PermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DealPaymentController extends AccountBaseController
{
    public function __construct(
        private readonly DealPaymentService $dealPaymentService,
    ) {
        parent::__construct();
    }

    public function show(Request $request, Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);

        $data = $this->dealPaymentService->getForDeal($deal);

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function store(Request $request, Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);
        $this->assertCanCreatePaymentRequest($deal);

        $validated = $request->validate([
            'amount' => 'nullable|numeric|min:0',
            'currency' => 'nullable|string|max:10',
            'provider_key' => 'nullable|string|in:manual-bank-transfer,nowpayments',
        ]);

        try {
            $data = $this->dealPaymentService->createForDeal($deal, user(), $validated);
        } catch (HttpException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ], 201);
    }

    public function confirm(Request $request, Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanViewDeal($deal);
        $this->assertCanConfirmPaymentTransfer();

        try {
            $data = $this->dealPaymentService->confirmBankTransfer($deal, user());
        } catch (HttpException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        } catch (\RuntimeException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], 502);
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    private function assertFeatureEnabled(): void
    {
        abort_unless(FeatureFlags::enabled('packages.online-payment'), 404);
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

    private function assertCanCreatePaymentRequest(Deal $deal): void
    {
        if ($deal->isLocked()) {
            abort_403(true);
        }

        // Same write gate as DealController::update — agent/participant/creator scopes only.
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->hasTeamMemberAccess($user->id),
        ];
        $access = PermissionService::checkAccess(user(), 'edit_deals', $deal, $dealRules);
        abort_403(!$access['canAccess']);

        // Watchers can see everything but never write — see DealNoteController::store.
        $isUnrestrictedWriter = in_array('admin', user_roles())
            || user()->permission('edit_deals') === 'all';
        if (!$isUnrestrictedWriter
            && $deal->added_by != user()->id
            && !$deal->hasTeamMemberAccess(user()->id)
            && $deal->dealWatchers()->where('user_id', user()->id)->exists()
        ) {
            abort_403(true);
        }
    }

    private function assertCanConfirmPaymentTransfer(): void
    {
        abort_403(user()->permission('edit_payments') != 'all');
    }
}
