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
        abort_403(user()->permission('edit_payments') != 'all');

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
        abort_403(user()->permission('edit_payments') != 'all');

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
        abort_404(!FeatureFlags::enabled('packages.online-payment'));
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
}
