import type { DealPaymentRequest, DealPaymentUiState } from "@/Types/api/deal-payment";

export function mapDealPaymentUiState(
    payment: Pick<
        DealPaymentRequest,
        "ui_state" | "can_confirm" | "show_checkout_url"
    > | null,
): {
    uiState: DealPaymentUiState | null;
    canConfirm: boolean;
    showCheckoutUrl: boolean;
    hasPaymentRequest: boolean;
} {
    if (!payment) {
        return {
            uiState: null,
            canConfirm: false,
            showCheckoutUrl: false,
            hasPaymentRequest: false,
        };
    }

    return {
        uiState: payment.ui_state,
        canConfirm: payment.can_confirm,
        showCheckoutUrl: payment.show_checkout_url,
        hasPaymentRequest: true,
    };
}

export function isTerminalPaymentState(uiState: DealPaymentUiState | null): boolean {
    return uiState === "confirmed" || uiState === "paid_online" || uiState === "failed";
}
