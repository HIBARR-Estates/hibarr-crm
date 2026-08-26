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
        hasPaymentRequest: Boolean(payment.payment_id),
    };
}

export function isTerminalPaymentState(uiState: DealPaymentUiState | null): boolean {
    return uiState === "confirmed" || uiState === "paid_online" || uiState === "failed";
}

export function paymentUiStateLabel(uiState: DealPaymentUiState): string {
    switch (uiState) {
        case "pending_payment":
            return "Pending payment";
        case "bank_transfer_pending":
            return "Bank transfer pending review";
        case "processing_online":
            return "Processing online payment";
        case "paid_online":
            return "Paid online";
        case "confirmed":
            return "Confirmed";
        case "failed":
            return "Failed";
        default:
            return "Unknown";
    }
}
