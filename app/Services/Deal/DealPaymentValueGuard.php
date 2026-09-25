<?php

namespace App\Services\Deal;

use App\Models\Deal;
use App\Models\User;
use App\Services\DealPaymentService;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * What a deal's payment request means for changing its value. Sits next to
 * the commission-lock check at every value-writing entry point.
 *
 * - No active request, or a failed/invalidated one: nothing to do.
 * - Unpaid (pending_payment): the value may change, but only once the caller
 *   has confirmed it understands the request will be invalidated — without
 *   that, the answer is a 409 the frontend turns into a warning and a retry.
 *   With it, the request is cancelled at OL *before* the write.
 * - Anything further along (proof uploaded, crypto in flight, paid,
 *   confirmed): the value is frozen. That also covers the gap between a
 *   payment being confirmed and ProcessDealWonJob commission-locking the deal.
 */
class DealPaymentValueGuard
{
    public const CODE_INVALIDATION_REQUIRED = 'payment_request_invalidation_required';

    public const CODE_LOCKED = 'deal_value_locked_by_payment_request';

    /** Request flag the frontend sends once the user accepts the invalidation. */
    public const CONFIRM_FLAG = 'invalidate_payment_request';

    public function __construct(
        private readonly DealPaymentService $payments,
    ) {}

    /**
     * Null when the write may proceed; otherwise the refusal for the caller to
     * render in its own response shape.
     *
     * @return array{status: int, code: string, message: string}|null
     */
    public function check(Deal $deal, bool $touchesValue, bool $confirmed, ?User $user): ?array
    {
        if (! $touchesValue) {
            return null;
        }

        $active = $this->payments->findActiveRequest($deal);
        if ($active === null) {
            return null;
        }

        if (DealPaymentService::uiStateOf($active) !== 'pending_payment') {
            return $this->locked();
        }

        if (! $confirmed) {
            return [
                'status' => 409,
                'code' => self::CODE_INVALIDATION_REQUIRED,
                'message' => __('messages.dealPaymentRequestInvalidationRequired'),
            ];
        }

        try {
            $this->payments->invalidatePending($deal, $user, 'Deal value changed');
        } catch (HttpException $e) {
            return $e->getStatusCode() === 409
                ? $this->locked()
                : [
                    'status' => $e->getStatusCode(),
                    'code' => 'payment_request_invalidation_failed',
                    'message' => $e->getMessage() ?: 'Unable to invalidate the payment request. The deal value was not changed.',
                ];
        }

        return null;
    }

    /**
     * @return array{status: int, code: string, message: string}
     */
    private function locked(): array
    {
        return [
            'status' => 403,
            'code' => self::CODE_LOCKED,
            'message' => __('messages.dealValueLockedByPaymentRequest'),
        ];
    }
}
