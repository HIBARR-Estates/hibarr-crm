<?php

namespace App\Services;

use App\Enums\OutcomeStatus;
use App\Models\Company;
use App\Models\Currency;
use App\Models\Deal;
use App\Models\DealAutomation;
use App\Models\Payment;
use App\Models\User;
use App\Scopes\CompanyScope;
use App\Services\Deal\DealOutcomeService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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
        // Cash is recorded here and never exists at OL, so there is nothing to refresh.
        if ($active !== null && ! empty($active->external_reference) && ! self::isCashPayment($active)) {
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
                    && ! in_array($row['ui_state'], ['failed', 'invalidated'], true)),
            'requests' => $requests,
        ];
    }

    /**
     * Issues a request in the chosen currency for part or all of the deal value
     * that confirmed payments have not already covered. The company-currency
     * amount is the one the user confirmed (or the remaining balance), converted
     * at the rate they confirmed. Cash is stored here and never sent to OL.
     *
     * @param  array<string, mixed>  $input  currency, base_amount (optional), exchange_rate (optional), provider_key (optional; `cash` stays in the CRM)
     * @return array<string, mixed>
     */
    public function createForDeal(Deal $deal, User $user, array $input): array
    {
        if ($this->findOpenRequest($deal) !== null) {
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
        // deal page's display makes. Confirmed requests already count toward it.
        $remaining = $this->remainingBaseAmount($deal);
        if ($remaining <= 0) {
            throw new HttpException(422, 'Confirmed payments already cover this deal\'s value.');
        }

        $baseAmount = $this->requestedBaseAmount($input, $remaining);

        $rate = $this->resolveRequestRate($companyCode, $currencyCode, $input);
        $amount = round($baseAmount * $rate, 2);
        if ($amount <= 0) {
            throw new HttpException(422, 'That exchange rate is too small for this deal value.');
        }

        $providerKey = ! empty($input['provider_key'])
            ? (string) $input['provider_key']
            : null;

        if ($providerKey === 'cash') {
            return $this->createCashRequest(
                $deal,
                $user,
                $currency,
                $companyCurrency,
                $baseAmount,
                $amount,
                $rate,
            );
        }

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
            ->first() ?? new Payment;

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
        $payment->expires_at = ! empty($olPayload['expiresAt'] ?? $olPayload['expires_at'] ?? null)
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

        if ($mapped['ui_state'] === 'cash_pending') {
            return $this->confirmCash($payment, $user);
        }

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

        $state = self::uiStateOf($payment);
        if (! in_array($state, ['pending_payment', 'cash_pending'], true)) {
            throw new HttpException(409, __('messages.dealValueLockedByPaymentRequest'));
        }

        // Cash never reached OL, so cancelling it is a local write.
        if ($state === 'cash_pending' || self::isCashPayment($payment)) {
            return $this->markInvalidated($payment, $user, $reason);
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
            if ($e->getStatusCode() !== 409) {
                throw $e;
            }

            // OL refused: re-read it to find out why.
            try {
                $olPayload = $this->olProxy->getFromOl((string) $payment->external_reference);
            } catch (HttpException) {
                $olPayload = null;
            }

            // Already cancelled — our earlier cancel committed at OL but its
            // response was lost (or an OL build without idempotent cancels).
            // That's the outcome we wanted, so record it and carry on instead
            // of telling the user the client is paying.
            if (strtolower((string) ($olPayload['status'] ?? '')) === 'cancelled') {
                return $this->markInvalidated($payment, $user, $reason);
            }

            // Otherwise the client started paying between the page load and
            // this save — pick up OL's state so the UI shows why.
            if ($olPayload !== null) {
                $this->syncFromOlPayload($payment, $olPayload);
            }

            throw new HttpException(409, __('messages.dealValueLockedByPaymentRequest'));
        }

        return $this->markInvalidated($payment, $user, $reason);
    }

    /**
     * @return array<string, mixed>
     */
    private function markInvalidated(Payment $payment, ?User $user, string $reason): array
    {
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
     * freezes the deal value once money has been taken.
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
     * A request the customer has not finished paying: pending checkout, a
     * bank transfer or online payment in review, or cash not yet confirmed.
     * A confirmed or paid request does not block the next batch.
     */
    public function findOpenRequest(Deal $deal): ?Payment
    {
        return $this->dealRequestsQuery($deal)
            ->where(function (Builder $query) {
                $query->whereNull('ol_status')
                    ->orWhereNotIn('ol_status', array_merge(self::INACTIVE_OL_STATUSES, ['completed']));
            })
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Company-currency total of payments the customer has actually paid
     * (confirmed transfer, completed online payment, or confirmed cash).
     */
    public function confirmedBaseTotal(Deal $deal): float
    {
        $total = $this->dealRequestsQuery($deal)
            ->get()
            ->sum(function (Payment $payment) {
                $state = self::uiStateOf($payment);
                if (! in_array($state, ['confirmed', 'paid_online'], true)) {
                    return 0;
                }

                return self::companyAmount($payment);
            });

        return round((float) $total, 2);
    }

    /**
     * How much of the deal value confirmed payments have not covered yet.
     */
    public function remainingBaseAmount(Deal $deal): float
    {
        $value = round((float) ($deal->value ?? 0), 2);

        return round(max(0, $value - $this->confirmedBaseTotal($deal)), 2);
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
        if (! $payment->deal_id) {
            return;
        }

        try {
            $deal = Deal::withoutGlobalScope(CompanyScope::class)->find($payment->deal_id);

            if ($deal === null) {
                return;
            }

            if ($deal->outcome_status !== OutcomeStatus::Won) {
                $this->outcomes->apply($deal, OutcomeStatus::Won, "Payment request #{$payment->id} confirmed");
            }
        } catch (\Throwable $e) {
            Log::error('DealPaymentService: failed to mark deal won after payment confirmation', [
                'payment_id' => $payment->id,
                'deal_id' => $payment->deal_id,
                'error' => $e->getMessage(),
            ]);
        }

        $this->firePaymentReceivedAutomations($payment);
    }

    /**
     * Runs the deal_payment_received automations (e.g. the Meta "Purchase"
     * conversion) — after the deal has been won, so they see its final state
     * and value. Once per payment (durable `automations_dispatched_at` claim):
     * markConfirmed() is documented idempotent and several paths can reach
     * it, but a conversion must be reported once.
     * Failures are logged, never thrown — the payment is already confirmed.
     */
    private function firePaymentReceivedAutomations(Payment $payment): void
    {
        $claimed = false;

        try {
            // Atomic, durable claim: only the caller that flips the column from
            // NULL runs the automations, and it survives cache flushes/expiry.
            $claimed = Payment::withoutGlobalScopes()
                ->whereKey($payment->id)
                ->whereNull('automations_dispatched_at')
                ->update(['automations_dispatched_at' => now()]) === 1;

            if (! $claimed) {
                return;
            }

            $deal = Deal::withoutGlobalScope(CompanyScope::class)->find($payment->deal_id);

            if ($deal !== null) {
                app(DealAutomationService::class)->process($deal, DealAutomation::TRIGGER_DEAL_PAYMENT_RECEIVED);
            }
        } catch (\Throwable $e) {
            Log::error('DealPaymentService: payment-received automations failed', [
                'payment_id' => $payment->id,
                'deal_id' => $payment->deal_id,
                'error' => $e->getMessage(),
            ]);

            // Release the claim so a later confirmation can retry the dispatch.
            if ($claimed) {
                try {
                    Payment::withoutGlobalScopes()->whereKey($payment->id)->update(['automations_dispatched_at' => null]);
                } catch (\Throwable) {
                    // Nothing more to do — never let this escape a confirmed payment.
                }
            }
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

    /**
     * @param  array<string, mixed>  $input
     */
    private function requestedBaseAmount(array $input, float $remaining): float
    {
        $supplied = $input['base_amount'] ?? null;
        if ($supplied === null || $supplied === '') {
            return $remaining;
        }

        if (! is_numeric($supplied)) {
            throw new HttpException(422, 'Enter an amount greater than zero.');
        }

        $amount = round((float) $supplied, 2);
        if ($amount <= 0) {
            throw new HttpException(422, 'Enter an amount greater than zero.');
        }

        // A cent of slack for float noise; anything more is a larger batch than is left.
        if ($amount - $remaining > 0.009) {
            throw new HttpException(422, 'The amount cannot be more than the remaining deal value.');
        }

        return $amount;
    }

    /**
     * Cash never leaves the CRM: no checkout link, no OL payment id, and
     * confirmation is a local "we received it" rather than an OL review.
     */
    private function createCashRequest(
        Deal $deal,
        User $user,
        Currency $currency,
        ?Currency $companyCurrency,
        float $baseAmount,
        float $amount,
        float $rate,
    ): array {
        $payment = new Payment;
        $payment->company_id = $deal->company_id;
        $payment->deal_id = $deal->id;
        $payment->external_reference = 'cash-'.Str::uuid()->toString();
        $payment->amount = $amount;
        $payment->base_amount = $baseAmount;
        $payment->currency_id = $currency->id;
        $payment->default_currency_id = $companyCurrency?->id;
        $payment->exchange_rate = 1 / $rate;
        $payment->gateway = 'cash';
        $payment->status = 'pending';
        $payment->checkout_url = null;
        $payment->ol_status = 'pending';
        $payment->ol_payment_type = 'cash';
        $payment->added_by = $user->id;
        $payment->save();
        $payment->loadMissing('currency');

        return $this->serializeDealPayment($payment);
    }

    /**
     * @return array<string, mixed>
     */
    private function confirmCash(Payment $payment, User $user): array
    {
        $payment->status = 'complete';
        $payment->ol_status = 'completed';
        $payment->verified_by_user_id = $user->id;
        $payment->verified_at = now();
        $payment->paid_on = now();
        $payment->save();

        $this->markConfirmed($payment);

        return $this->serializeDealPayment($payment->fresh(['currency']));
    }

    public static function isCashPayment(Payment $payment): bool
    {
        return $payment->gateway === 'cash'
            || $payment->ol_payment_type === 'cash'
            || str_starts_with((string) $payment->external_reference, 'cash-');
    }

    /**
     * Company-currency figure this request covers. base_amount is that figure
     * when the request was issued; older rows fall back to amount × rate.
     */
    private static function companyAmount(Payment $payment): float
    {
        if ($payment->base_amount !== null) {
            return round((float) $payment->base_amount, 2);
        }

        $rate = (float) ($payment->exchange_rate ?? 0);

        return round((float) $payment->amount * ($rate > 0 ? $rate : 1), 2);
    }

    /**
     * Units of $currencyCode per 1 unit of $companyCode.
     *
     * A rate sent with the request is the one the user confirmed. Paying in
     * the company currency is always 1:1, whatever was sent. With no rate
     * supplied, fall back to the live reference rate.
     *
     * @param  array<string, mixed>  $input
     */
    private function resolveRequestRate(string $companyCode, string $currencyCode, array $input): float
    {
        if ($currencyCode === $companyCode) {
            return 1.0;
        }

        if (array_key_exists('exchange_rate', $input) && $input['exchange_rate'] !== null && $input['exchange_rate'] !== '') {
            $supplied = $input['exchange_rate'];
            if (! is_numeric($supplied) || (float) $supplied <= 0) {
                throw new HttpException(422, 'Exchange rate must be greater than zero.');
            }

            return (float) $supplied;
        }

        $rate = $this->exchangeRates->rate($companyCode, $currencyCode);
        if ($rate === null || $rate <= 0) {
            throw new HttpException(422, "Live exchange rate {$companyCode} → {$currencyCode} is unavailable. Enter a rate to continue.");
        }

        return $rate;
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
        if (! empty($verifiedAt)) {
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
