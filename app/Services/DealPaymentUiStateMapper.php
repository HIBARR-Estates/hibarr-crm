<?php

namespace App\Services;

class DealPaymentUiStateMapper
{
    /**
     * @return array{ui_state: string, can_confirm: bool, show_checkout_url: bool}
     */
    public static function map(?string $olStatus, ?string $olPaymentType, ?int $verifiedByUserId, ?string $verifiedAt): array
    {
        $status = strtolower(trim((string) $olStatus));
        $type = strtolower(trim((string) $olPaymentType));

        // The CRM cancels a deal payment request (a manual cancel, or a deal
        // value change before the client paid), so an OL "cancelled" is always
        // an invalidation, distinct from the payment itself failing or expiring.
        if ($status === 'cancelled') {
            return [
                'ui_state' => 'invalidated',
                'can_confirm' => false,
                'show_checkout_url' => false,
            ];
        }

        if (in_array($status, ['failed', 'expired'], true)) {
            return [
                'ui_state' => 'failed',
                'can_confirm' => false,
                'show_checkout_url' => false,
            ];
        }

        // Cash is recorded in the CRM and confirmed here. It has no checkout link.
        if ($status === 'pending' && $type === 'cash') {
            return [
                'ui_state' => 'cash_pending',
                'can_confirm' => true,
                'show_checkout_url' => false,
            ];
        }

        // A manual transfer the CRM has already verified is confirmed, even
        // when OL still reports "confirming" because its write-back has not
        // landed yet. Offering confirm again would double-charge the review.
        if ($type === 'manual' && $verifiedByUserId && $verifiedAt && in_array($status, ['confirming', 'completed'], true)) {
            return [
                'ui_state' => 'confirmed',
                'can_confirm' => false,
                'show_checkout_url' => false,
            ];
        }

        if ($status === 'pending') {
            return [
                'ui_state' => 'pending_payment',
                'can_confirm' => false,
                'show_checkout_url' => true,
            ];
        }

        if ($status === 'confirming') {
            if ($type === 'manual') {
                return [
                    'ui_state' => 'bank_transfer_pending',
                    'can_confirm' => true,
                    'show_checkout_url' => false,
                ];
            }

            return [
                'ui_state' => 'processing_online',
                'can_confirm' => false,
                'show_checkout_url' => false,
            ];
        }

        if ($status === 'completed') {
            if (in_array($type, ['manual', 'cash'], true) && $verifiedByUserId && $verifiedAt) {
                return [
                    'ui_state' => 'confirmed',
                    'can_confirm' => false,
                    'show_checkout_url' => false,
                ];
            }

            return [
                'ui_state' => 'paid_online',
                'can_confirm' => false,
                'show_checkout_url' => false,
            ];
        }

        return [
            'ui_state' => 'pending_payment',
            'can_confirm' => false,
            'show_checkout_url' => false,
        ];
    }

    /**
     * SQL-shaped mirror of map()'s branches, keyed by the same ui_state
     * vocabulary, for server-side filtering (PaymentRequestController).
     * Every branch here must stay in 1:1 correspondence with map() above —
     * see DealPaymentUiStateMapperQueryScopesTest, which walks the same
     * fixtures map()'s own test uses and asserts they land in the matching
     * bucket here and no other.
     *
     * @return array<string, callable(\Illuminate\Database\Eloquent\Builder): void>
     */
    public static function queryScopes(): array
    {
        return [
            'failed' => fn ($q) => $q->whereIn('ol_status', ['failed', 'expired']),
            'invalidated' => fn ($q) => $q->where('ol_status', 'cancelled'),
            'pending_payment' => fn ($q) => $q->where(function ($q2) {
                $q2->where(function ($pending) {
                    $pending->where('ol_status', 'pending')
                        ->where(function ($type) {
                            $type->whereNull('ol_payment_type')
                                ->orWhere('ol_payment_type', '!=', 'cash');
                        });
                })->orWhereNull('ol_status')
                    ->orWhereNotIn('ol_status', ['failed', 'expired', 'cancelled', 'pending', 'confirming', 'completed']);
            }),
            'cash_pending' => fn ($q) => $q->where('ol_status', 'pending')->where('ol_payment_type', 'cash'),
            'bank_transfer_pending' => fn ($q) => $q->where('ol_status', 'confirming')
                ->where('ol_payment_type', 'manual')
                ->where(function ($q2) {
                    $q2->whereNull('verified_by_user_id')->orWhereNull('verified_at');
                }),
            'processing_online' => fn ($q) => $q->where('ol_status', 'confirming')->where('ol_payment_type', '!=', 'manual'),
            'confirmed' => fn ($q) => $q->where(function ($q2) {
                $q2->where(function ($manual) {
                    $manual->whereIn('ol_status', ['confirming', 'completed'])
                        ->where('ol_payment_type', 'manual')
                        ->whereNotNull('verified_by_user_id')
                        ->whereNotNull('verified_at');
                })->orWhere(function ($cash) {
                    $cash->where('ol_status', 'completed')
                        ->where('ol_payment_type', 'cash')
                        ->whereNotNull('verified_by_user_id')
                        ->whereNotNull('verified_at');
                });
            }),
            'paid_online' => fn ($q) => $q->where('ol_status', 'completed')
                ->where(function ($q2) {
                    $q2->where(function ($online) {
                        $online->whereNotIn('ol_payment_type', ['manual', 'cash'])
                            ->orWhereNull('ol_payment_type');
                    })->orWhereNull('verified_by_user_id')
                        ->orWhereNull('verified_at');
                }),
        ];
    }
}
