<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use Carbon\Carbon;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DealPaymentService
{
    public function __construct(
        private readonly OlDealPaymentProxyService $olProxy,
        private readonly OlPaymentReviewDecisionService $reviewDecisionService,
    ) {}

    /**
     * @return array<string, mixed>|null
     */
    public function getForDeal(Deal $deal): ?array
    {
        $payment = $this->findDealPaymentRequest($deal);
        if ($payment === null) {
            return null;
        }

        $olPayload = null;
        if (!empty($payment->external_reference)) {
            try {
                $olPayload = $this->olProxy->getFromOl((string) $payment->external_reference);
                $this->syncFromOlPayload($payment, $olPayload);
            } catch (HttpException $e) {
                if ($e->getStatusCode() >= 500) {
                    throw $e;
                }
            }
        }

        return $this->serializeDealPayment($payment->fresh(['currency']), $olPayload);
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function createForDeal(Deal $deal, User $user, array $input): array
    {
        if ($this->findDealPaymentRequest($deal) !== null) {
            throw new HttpException(409, 'A payment request already exists for this deal.');
        }

        $deal->loadMissing('currency');

        $amount = array_key_exists('amount', $input)
            ? (float) $input['amount']
            : (float) ($deal->value ?? 0);

        $currency = strtoupper(trim((string) (
            $input['currency']
            ?? $deal->currency?->currency_code
            ?? company()?->currency?->currency_code
            ?? 'EUR'
        )));

        $providerKey = (string) ($input['provider_key'] ?? 'manual-bank-transfer');

        $olPayload = $this->olProxy->createForDeal($deal, [
            'amount' => $amount,
            'currency' => $currency,
            'provider_key' => $providerKey,
        ]);

        $paymentId = (string) ($olPayload['paymentId'] ?? $olPayload['payment_id'] ?? '');
        if ($paymentId === '') {
            throw new HttpException(502, 'Payment service did not return a payment id.');
        }

        $payment = Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order'])
            ->where('company_id', $deal->company_id)
            ->where('external_reference', $paymentId)
            ->first() ?? new Payment();

        $payment->company_id = $deal->company_id;
        $payment->deal_id = $deal->id;
        $payment->external_reference = $paymentId;
        $payment->amount = round((float) ($olPayload['amount'] ?? $amount), 2);
        $payment->gateway = $providerKey;
        $payment->status = 'pending';
        $payment->checkout_url = (string) ($olPayload['checkoutUrl'] ?? $olPayload['checkout_url'] ?? '');
        $payment->expires_at = !empty($olPayload['expiresAt'] ?? $olPayload['expires_at'] ?? null)
            ? Carbon::parse($olPayload['expiresAt'] ?? $olPayload['expires_at'])
            : null;
        $payment->ol_status = strtolower((string) ($olPayload['status'] ?? 'pending'));
        $payment->ol_payment_type = $this->paymentTypeFromProvider($providerKey);
        $payment->added_by = $user->id;

        if ($deal->currency_id) {
            $payment->currency_id = $deal->currency_id;
        }

        $payment->save();
        $payment->loadMissing('currency');

        return $this->serializeDealPayment($payment, $olPayload);
    }

    /**
     * @return array<string, mixed>
     */
    public function confirmBankTransfer(Deal $deal, User $user): array
    {
        $payment = $this->findDealPaymentRequest($deal);
        if ($payment === null) {
            throw new NotFoundHttpException('No payment request found for this deal.');
        }

        $mapped = DealPaymentUiStateMapper::map(
            $payment->ol_status,
            $payment->ol_payment_type,
            $payment->verified_by_user_id,
            $payment->verified_at?->toIso8601String()
        );

        if ($mapped['ui_state'] !== 'bank_transfer_pending') {
            throw new HttpException(409, 'This payment request cannot be confirmed in its current state.');
        }

        $this->reviewDecisionService->notifyOrFail($payment, 'complete', $user);

        $payment->status = 'complete';
        $payment->verified_by_user_id = $user->id;
        $payment->verified_at = now();
        $payment->paid_on = now();
        $payment->save();

        $olPayload = null;
        try {
            $olPayload = $this->olProxy->getFromOl((string) $payment->external_reference);
            $this->syncFromOlPayload($payment, $olPayload);
        } catch (HttpException $e) {
            if ($e->getStatusCode() >= 500) {
                throw $e;
            }

            $payment->ol_status = 'completed';
            $payment->save();
        }

        return $this->serializeDealPayment($payment->fresh(['currency']), $olPayload);
    }

    /**
     * @param  array<string, mixed>|null  $olPayload
     * @return array<string, mixed>
     */
    public function serializeDealPayment(Payment $payment, ?array $olPayload = null): array
    {
        $verifiedByUserId = $payment->verified_by_user_id;
        $verifiedAt = $payment->verified_at?->toIso8601String();

        if ($olPayload !== null) {
            $verifiedByUserId = (int) ($olPayload['verifiedByUserId'] ?? $olPayload['verified_by_user_id'] ?? $verifiedByUserId);
            $verifiedAt = $olPayload['verifiedAt'] ?? $olPayload['verified_at'] ?? $verifiedAt;
        }

        $verifiedBy = null;
        if ($verifiedByUserId) {
            $verifier = User::find($verifiedByUserId);
            if ($verifier) {
                $verifiedBy = [
                    'id' => $verifier->id,
                    'name' => $verifier->name,
                    'email' => $verifier->email,
                ];
            }
        }

        $mapped = DealPaymentUiStateMapper::map(
            $payment->ol_status,
            $payment->ol_payment_type,
            $verifiedByUserId ?: null,
            $verifiedAt
        );

        return [
            'id' => $payment->id,
            'deal_id' => $payment->deal_id,
            'payment_id' => $payment->external_reference,
            'amount' => $payment->amount,
            'currency' => $payment->currency?->currency_code,
            'currency_id' => $payment->currency_id,
            'gateway' => $payment->gateway,
            'crm_status' => $payment->status,
            'ol_status' => $payment->ol_status,
            'ol_payment_type' => $payment->ol_payment_type,
            'ui_state' => $mapped['ui_state'],
            'can_confirm' => $mapped['can_confirm'],
            'show_checkout_url' => $mapped['show_checkout_url'],
            'checkout_url' => $payment->checkout_url,
            'expires_at' => $payment->expires_at?->toIso8601String(),
            'verified_by_user_id' => $verifiedByUserId ?: null,
            'verified_by' => $verifiedBy,
            'verified_at' => $verifiedAt,
            'proof_url' => $payment->bill ? $payment->file_url : null,
            'updated_at' => $payment->updated_at?->toIso8601String(),
            'created_at' => $payment->created_at?->toIso8601String(),
        ];
    }

    private function findDealPaymentRequest(Deal $deal): ?Payment
    {
        return Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order', 'currency'])
            ->where('deal_id', $deal->id)
            ->whereNotNull('external_reference')
            ->where('external_reference', '!=', '')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $olPayload
     */
    private function syncFromOlPayload(Payment $payment, array $olPayload): void
    {
        $payment->ol_status = strtolower((string) ($olPayload['status'] ?? $payment->ol_status));
        $payment->ol_payment_type = strtolower((string) (
            $olPayload['paymentType']
            ?? $olPayload['payment_type']
            ?? $payment->ol_payment_type
        ));

        $verifiedByUserId = $olPayload['verifiedByUserId'] ?? $olPayload['verified_by_user_id'] ?? null;
        if ($verifiedByUserId !== null) {
            $payment->verified_by_user_id = (int) $verifiedByUserId;
        }

        $verifiedAt = $olPayload['verifiedAt'] ?? $olPayload['verified_at'] ?? null;
        if (!empty($verifiedAt)) {
            $payment->verified_at = Carbon::parse($verifiedAt);
        }

        $olStatus = strtolower((string) ($payment->ol_status ?? ''));
        if ($olStatus === 'completed') {
            $payment->status = 'complete';
            if ($payment->paid_on === null) {
                $payment->paid_on = now();
            }
        } elseif (in_array($olStatus, ['failed', 'expired', 'cancelled'], true)) {
            $payment->status = 'failed';
        } elseif ($olStatus === 'confirming') {
            $payment->status = 'pending';
        }

        $payment->save();
    }

    private function paymentTypeFromProvider(string $providerKey): string
    {
        return match (strtolower($providerKey)) {
            'manual-bank-transfer' => 'manual',
            'nowpayments' => 'crypto',
            default => 'fiat',
        };
    }
}
