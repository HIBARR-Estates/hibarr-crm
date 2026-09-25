<?php

namespace App\Services;

use App\Enums\OutcomeStatus;
use App\Models\Company;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use App\Services\Deal\DealOutcomeService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DealPaymentService
{
    /** OL statuses after which a request no longer counts as the deal's active one. */
    private const INACTIVE_OL_STATUSES = ['failed', 'expired', 'cancelled'];

    public function __construct(
        private readonly OlDealPaymentProxyService $olProxy,
        private readonly OlPaymentReviewDecisionService $reviewDecisionService,
        private readonly ExchangeRateService $exchangeRates,
        private readonly DealOutcomeService $outcomes,
    ) {}

    /**
     * Who may confirm a manual bank transfer. The admin role passes on its own:
     * User::permission() reads user_permissions only (no role join), so an admin
     * whose edit_payments row was missing or seeded low was locked out — see
     * 2026_09_25_000001_grant_edit_payments_to_admins for the data backfill.
     */
    public static function canConfirmTransfer(User $user): bool
    {
        return collect($user->roles)->contains('name', 'admin')
            || $user->permission('edit_payments') === 'all';
    }

    /**
     * The deal's current request plus its full history (newest first). Only
     * the active request is refreshed from OL — invalidated and failed ones
     * are terminal and never change again.
     *
     * @return array{active: array<string, mixed>|null, requests: array<int, array<string, mixed>>}
     */
    public function getForDeal(Deal $deal): array
    {
        $active = $this->findActiveRequest($deal);

        $olPayload = null;
        if ($active !== null && !empty($active->external_reference)) {
            try {
                $olPayload = $this->olProxy->getFromOl((string) $active->external_reference);
                $this->syncFromOlPayload($active, $olPayload);
            } catch (HttpException $e) {
                if ($e->getStatusCode() >= 500) {
                    throw $e;
                }
            }
        }

        $requests = $this->dealRequestsQuery($deal)
            ->with('currency')
            ->orderByDesc('id')
            ->get()
            ->map(fn (Payment $payment) => $this->serializeDealPayment(
                $payment,
                $active !== null && $payment->id === $active->id ? $olPayload : null
            ))
            ->values()
            ->all();

        $activeId = $active?->id;

        return [
            // Re-read from the list: syncing may have just moved the active
            // request into a terminal state (e.g. OL expired it).
            'active' => $activeId === null
                ? null
                : collect($requests)->first(fn (array $row) => $row['id'] === $activeId
                    && !in_array($row['ui_state'], ['failed', 'invalidated'], true)),
            'requests' => $requests,
        ];
    }

    /**
     * Issues a request in the chosen currency, converted from the deal's value
     * in company currency at the live rate. The amount is computed here, never
     * taken from the client, so the figure sent to OL is always the deal value.
     *
     * @param  array<string, mixed>  $input  currency (ISO code), provider_key (optional)
     * @return array<string, mixed>
     */
    public function createForDeal(Deal $deal, User $user, array $input): array
    {
        if ($this->findActiveRequest($deal) !== null) {
            throw new HttpException(409, 'An active payment request already exists for this deal.');
        }

        $companyCurrency = $this->companyCurrency($deal);
        $companyCode = strtoupper((string) ($companyCurrency?->currency_code ?? 'EUR'));

        $currencyCode = strtoupper(trim((string) ($input['currency'] ?? $companyCode)));
        $currency = $this->resolveCompanyCurrency($deal->company_id, $currencyCode);
        if ($currency === null) {
            throw new HttpException(422, "The currency {$currencyCode} is not available for this company.");
        }

        // deal.value is treated as company currency — the same assumption the
        // deal page's display makes.
        $baseAmount = round((float) ($deal->value ?? 0), 2);
        if ($baseAmount <= 0) {
            throw new HttpException(422, 'The deal has no value to request payment for.');
        }

        $rate = $this->exchangeRates->rate($companyCode, $currencyCode);
        if ($rate === null || $rate <= 0) {
            throw new HttpException(422, "Live exchange rate {$companyCode} → {$currencyCode} is unavailable. Try again shortly.");
        }

        $amount = round($baseAmount * $rate, 2);

        $providerKey = !empty($input['provider_key'])
            ? (string) $input['provider_key']
            : null;

        $olPayload = $this->olProxy->createForDeal($deal, array_filter([
            'amount' => $amount,
            'currency' => $currencyCode,
            'provider_key' => $providerKey,
        ], static fn ($value) => $value !== null && $value !== ''));

        $paymentId = (string) ($olPayload['paymentId'] ?? $olPayload['payment_id'] ?? '');
        if ($paymentId === '') {
            throw new HttpException(502, 'Payment service did not return a payment id.');
        }

        $resolvedProvider = $providerKey
            ?? (string) ($olPayload['providerKey'] ?? $olPayload['provider_key'] ?? '');
        $resolvedPaymentType = strtolower((string) (
            $olPayload['paymentType']
            ?? $olPayload['payment_type']
            ?? ($resolvedProvider !== '' ? $this->paymentTypeFromProvider($resolvedProvider) : '')
        ));

        $payment = Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order'])
            ->where('company_id', $deal->company_id)
            ->where('external_reference', $paymentId)
            ->first() ?? new Payment();

        $payment->company_id = $deal->company_id;
        $payment->deal_id = $deal->id;
        $payment->external_reference = $paymentId;
        $payment->amount = round((float) ($olPayload['amount'] ?? $amount), 2);
        $payment->base_amount = $baseAmount;
        $payment->currency_id = $currency->id;
        $payment->default_currency_id = $companyCurrency?->id;
        // Worksuite convention: amount × exchange_rate = company amount.
        $payment->exchange_rate = 1 / $rate;
        $payment->gateway = $resolvedProvider !== '' ? $resolvedProvider : null;
        $payment->status = 'pending';
        $payment->checkout_url = (string) ($olPayload['checkoutUrl'] ?? $olPayload['checkout_url'] ?? '');
        $payment->expires_at = !empty($olPayload['expiresAt'] ?? $olPayload['expires_at'] ?? null)
            ? Carbon::parse($olPayload['expiresAt'] ?? $olPayload['expires_at'])
            : null;
        $payment->ol_status = strtolower((string) ($olPayload['status'] ?? 'pending'));
        $payment->ol_payment_type = $resolvedPaymentType !== '' ? $resolvedPaymentType : null;
        $payment->added_by = $user->id;

        $payment->save();
        $payment->loadMissing('currency');

        return $this->serializeDealPayment($payment, $olPayload);
    }

    /**
     * @return array<string, mixed>
     */
    public function confirmBankTransfer(Deal $deal, User $user): array
    {
        $payment = $this->findActiveRequest($deal);
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
            // Won is applied once, below — whatever OL reports back here.
            $this->syncFromOlPayload($payment, $olPayload, markConfirmed: false);
        } catch (HttpException $e) {
            if ($e->getStatusCode() >= 500) {
                throw $e;
            }

            $payment->ol_status = 'completed';
            $payment->save();
        }

        $this->markConfirmed($payment);

        return $this->serializeDealPayment($payment->fresh(['currency']), $olPayload);
    }

    /**
     * A still-unpaid request is cancelled at OL (so its checkout link stops
     * working) before the deal's value changes. OL is called first: if it
     * can't be reached, the local request stays untouched and the caller must
     * not save the new value — a stale link that still accepts payment is the
     * one outcome this exists to prevent.
     *
     * Returns the invalidated request, or null when the deal had no active one.
     *
     * @return array<string, mixed>|null
     */
    public function invalidatePending(Deal $deal, ?User $user, string $reason): ?array
    {
        $payment = $this->findActiveRequest($deal);
        if ($payment === null) {
            return null;
        }

        if (self::uiStateOf($payment) !== 'pending_payment') {
            throw new HttpException(409, __('messages.dealValueLockedByPaymentRequest'));
        }

        try {
            $this->olProxy->cancel((string) $payment->external_reference, array_filter([
                'reason' => $reason,
                'cancelled_by' => $user ? [
                    'id' => $user->id,
                    'email' => $user->email,
                    'name' => $user->name,
                ] : null,
            ], static fn ($value) => $value !== null));
        } catch (HttpException $e) {
            if ($e->getStatusCode() === 409) {
                // The client started paying between the page load and this
                // save — pick up OL's state so the UI shows why.
                try {
                    $this->syncFromOlPayload($payment, $this->olProxy->getFromOl((string) $payment->external_reference));
                } catch (HttpException) {
                    // The 409 below is the answer either way.
                }

                throw new HttpException(409, __('messages.dealValueLockedByPaymentRequest'));
            }

            throw $e;
        }

        $payment->ol_status = 'cancelled';
        $payment->status = 'failed';
        $payment->invalidated_at = now();
        $payment->invalidated_by_user_id = $user?->id;
        $payment->invalidation_reason = mb_substr($reason, 0, 255);
        $payment->save();

        return $this->serializeDealPayment($payment->fresh(['currency']));
    }

    /**
     * The deal's active request, or null. "Active" is anything not failed,
     * expired or invalidated — including confirmed/paid ones, which is what
     * stops a second request being issued for an already-paid deal.
     */
    public function findActiveRequest(Deal $deal): ?Payment
    {
        return $this->dealRequestsQuery($deal)
            ->where(function (Builder $query) {
                $query->whereNull('ol_status')
                    ->orWhereNotIn('ol_status', self::INACTIVE_OL_STATUSES);
            })
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Whether the client has paid through a payment request (confirmed bank
     * transfer or completed online payment). Such deals are closed out: they
     * are excluded from deal automations.
     */
    public function hasPaidRequest(Deal $deal): bool
    {
        return $this->dealRequestsQuery($deal)
            ->where('ol_status', 'completed')
            ->exists();
    }

    public static function uiStateOf(Payment $payment): string
    {
        return DealPaymentUiStateMapper::map(
            $payment->ol_status,
            $payment->ol_payment_type,
            $payment->verified_by_user_id,
            $payment->verified_at?->toIso8601String()
        )['ui_state'];
    }

    /**
     * A confirmed payment wins the deal — from any outcome, Lost included.
     * Goes through DealOutcomeService like a manual Won, so DealWonEvent fires
     * and ProcessDealWonJob distributes commission and sets commission_locked.
     * commission_locked is deliberately NOT set here: the job skips any deal
     * that already has it, so setting it first would mean no commission is
     * ever paid out.
     *
     * Idempotent; failures are logged rather than thrown because the payment
     * itself is already confirmed at OL by the time this runs.
     */
    public function markConfirmed(Payment $payment): void
    {
        if (!$payment->deal_id) {
            return;
        }

        try {
            $deal = Deal::withoutGlobalScope(CompanyScope::class)->find($payment->deal_id);

            if ($deal === null || $deal->outcome_status === OutcomeStatus::Won) {
                return;
            }

            $this->outcomes->apply($deal, OutcomeStatus::Won, "Payment request #{$payment->id} confirmed");
        } catch (\Throwable $e) {
            Log::error('DealPaymentService: failed to mark deal won after payment confirmation', [
                'payment_id' => $payment->id,
                'deal_id' => $payment->deal_id,
                'error' => $e->getMessage(),
            ]);
        }
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

        $baseCurrency = $payment->default_currency_id
            ? Currency::withoutGlobalScope(CompanyScope::class)->find($payment->default_currency_id)
            : null;

        return [
            'id' => $payment->id,
            'deal_id' => $payment->deal_id,
            'payment_id' => $payment->external_reference,
            'amount' => $payment->amount,
            'currency' => $payment->currency?->currency_code,
            'currency_symbol' => $payment->currency?->currency_symbol,
            'currency_id' => $payment->currency_id,
            'base_amount' => $payment->base_amount !== null ? (float) $payment->base_amount : null,
            'base_currency' => $baseCurrency?->currency_code,
            'base_currency_symbol' => $baseCurrency?->currency_symbol,
            // "1 base = rate currency" — the inverse of the stored Worksuite rate.
            'rate' => $payment->exchange_rate ? round(1 / (float) $payment->exchange_rate, 6) : null,
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
            'invalidated_at' => $payment->invalidated_at?->toIso8601String(),
            'invalidation_reason' => $payment->invalidation_reason,
            'proof_url' => $payment->bill ? $payment->file_url : null,
            'updated_at' => $payment->updated_at?->toIso8601String(),
            'created_at' => $payment->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return Builder<Payment>
     */
    private function dealRequestsQuery(Deal $deal): Builder
    {
        return Payment::withoutGlobalScope(CompanyScope::class)
            ->without(['order', 'currency'])
            ->where('deal_id', $deal->id)
            ->whereNotNull('external_reference')
            ->where('external_reference', '!=', '');
    }

    private function companyCurrency(Deal $deal): ?Currency
    {
        $currencyId = Company::withoutGlobalScopes()->whereKey($deal->company_id)->value('currency_id');

        return $currencyId
            ? Currency::withoutGlobalScope(CompanyScope::class)->find($currencyId)
            : null;
    }

    private function resolveCompanyCurrency(?int $companyId, string $code): ?Currency
    {
        return Currency::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)
            ->where('currency_code', $code)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $olPayload
     * @param  bool  $markConfirmed  win the deal when this sync is what completes the payment
     */
    private function syncFromOlPayload(Payment $payment, array $olPayload, bool $markConfirmed = true): void
    {
        $previousOlStatus = strtolower((string) ($payment->ol_status ?? ''));

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
        } elseif (in_array($olStatus, self::INACTIVE_OL_STATUSES, true)) {
            $payment->status = 'failed';
        } elseif ($olStatus === 'confirming') {
            $payment->status = 'pending';
        }

        $payment->save();

        if ($markConfirmed && $olStatus === 'completed' && $previousOlStatus !== 'completed') {
            $this->markConfirmed($payment);
        }
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
