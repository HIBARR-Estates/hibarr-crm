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
}
