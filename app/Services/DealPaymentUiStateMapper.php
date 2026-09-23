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

        if (in_array($status, ['failed', 'expired', 'cancelled'], true)) {
            return [
                'ui_state' => 'failed',
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
            if ($type === 'manual' && $verifiedByUserId && $verifiedAt) {
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
            'failed' => fn ($q) => $q->whereIn('ol_status', ['failed', 'expired', 'cancelled']),
            'pending_payment' => fn ($q) => $q->where(function ($q2) {
                $q2->where('ol_status', 'pending')
                    ->orWhereNull('ol_status')
                    ->orWhereNotIn('ol_status', ['failed', 'expired', 'cancelled', 'pending', 'confirming', 'completed']);
            }),
            'bank_transfer_pending' => fn ($q) => $q->where('ol_status', 'confirming')->where('ol_payment_type', 'manual'),
            'processing_online' => fn ($q) => $q->where('ol_status', 'confirming')->where('ol_payment_type', '!=', 'manual'),
            'confirmed' => fn ($q) => $q->where('ol_status', 'completed')
                ->where('ol_payment_type', 'manual')
                ->whereNotNull('verified_by_user_id')
                ->whereNotNull('verified_at'),
            'paid_online' => fn ($q) => $q->where('ol_status', 'completed')
                ->where(function ($q2) {
                    $q2->where('ol_payment_type', '!=', 'manual')
                        ->orWhereNull('verified_by_user_id')
                        ->orWhereNull('verified_at');
                }),
        ];
    }
}
