<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\Payment;
use App\Services\DealPaymentDocumentService;
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
        private readonly DealPaymentDocumentService $documents,
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

        // No amount: the service converts the deal's value into the chosen
        // currency itself, so the figure sent to OL can't drift from the deal.
        $validated = $request->validate([
            'currency' => 'required|string|size:3|alpha',
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

    /**
     * Cancels the deal's still-pending request. The row stays in the history
     * as cancelled so the sequence of requests remains readable; the checkout
     * link stops working. Same OL rules as a value-change invalidation: once
     * the client has started paying, this is refused.
     */
    public function cancel(Request $request, Deal $deal): JsonResponse
    {
        $this->assertFeatureEnabled();
        $this->assertCanCancelPaymentRequest($deal);

        $validated = $request->validate([
            'reason' => 'nullable|string|max:255',
        ]);

        $reason = trim((string) ($validated['reason'] ?? ''));
        if ($reason === '') {
            $reason = 'Cancelled manually';
        }

        try {
            $data = $this->dealPaymentService->invalidatePending($deal, user(), $reason);
        } catch (HttpException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        }

        if ($data === null) {
            return response()->json([
                'status' => 'fail',
                'message' => 'No pending payment request to cancel.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    /**
     * Replaces an expired checkout link: the open request is cancelled, then
     * a new one is created in the same currency from the deal's current value.
     */
    public function retry(Deal $deal, Payment $payment): JsonResponse
    {
        $this->assertFeatureEnabled();
        if ($deal->isLocked()) {
            abort_403(true);
        }
        $this->assertCanCancelPaymentRequest($deal);
        abort_unless((int) $payment->deal_id === (int) $deal->id, 404);

        try {
            $data = $this->dealPaymentService->reissueExpired($deal, $payment, user());
        } catch (HttpException $e) {
            return response()->json([
                'status' => 'fail',
                'message' => $e->getMessage(),
            ], $e->getStatusCode());
        }

        return response()->json([
            'status' => 'success',
            'data' => $data,
        ]);
    }

    public function document(Deal $deal, Payment $payment, string $kind)
    {
        $this->assertFeatureEnabled();
        $this->assertCanReadPaymentDocuments($deal);
        abort_unless((int) $payment->deal_id === (int) $deal->id, 404);
        abort_unless(filled($payment->external_reference), 404);

        try {
            $copy = request()->query('copy') === 'copy' ? 'copy' : 'original';

            return $this->documents->download($payment, $kind, $copy);
        } catch (HttpException $e) {
            abort($e->getStatusCode(), $e->getMessage());
        }
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
        abort_403(! DealPaymentService::canConfirmTransfer(user()));
    }

    /**
     * The person who can edit the deal, or a finance user who can confirm
     * transfers. Pending requests are cancelled from both the deal and the
     * payment-requests list.
     */
    private function assertCanCancelPaymentRequest(Deal $deal): void
    {
        if (DealPaymentService::canConfirmTransfer(user())) {
            return;
        }

        $this->assertCanCreatePaymentRequest($deal);
    }

    /**
     * Invoices and receipts are readable by anyone who can see the deal, and
     * by the finance users who work the payment-requests list.
     */
    private function assertCanReadPaymentDocuments(Deal $deal): void
    {
        if (DealPaymentService::canConfirmTransfer(user())) {
            return;
        }

        $this->assertCanViewDeal($deal);
    }
}
