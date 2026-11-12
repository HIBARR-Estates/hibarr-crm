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

const PAID_STATES = new Set<DealPaymentUiState>(["confirmed", "paid_online"]);

/** Company-currency total of payments the customer has actually paid. */
export function coveredBaseAmount(
    requests: Pick<DealPaymentRequest, "ui_state" | "base_amount" | "amount" | "rate">[],
): number {
    const total = requests.reduce((sum, request) => {
        if (!PAID_STATES.has(request.ui_state)) return sum;
        if (request.base_amount !== null && request.base_amount !== undefined) {
            return sum + Number(request.base_amount);
        }
        if (request.rate && request.rate > 0) return sum + Number(request.amount) / request.rate;
        return sum + (Number(request.amount) || 0);
    }, 0);

    return Math.round(total * 100) / 100;
}

/** How much of the deal value confirmed payments have not covered yet. */
export function remainingDealBalance(
    dealValue: number,
    requests: Pick<DealPaymentRequest, "ui_state" | "base_amount" | "amount" | "rate">[],
): number {
    return Math.max(0, Math.round((dealValue - coveredBaseAmount(requests)) * 100) / 100);
}

export function isTerminalPaymentState(uiState: DealPaymentUiState | null): boolean {
    return (
        uiState === "confirmed"
        || uiState === "paid_online"
        || uiState === "failed"
        || uiState === "invalidated"
    );
}

/** Confirmed bank transfer or a completed online payment. */
export function isCollectedPaymentState(uiState: DealPaymentUiState | null): boolean {
    return uiState === "confirmed" || uiState === "paid_online";
}

/** Only a request the client has not started paying can be cancelled. */
export function canCancelPaymentRequest(uiState: DealPaymentUiState | null): boolean {
    return uiState === "pending_payment" || uiState === "cash_pending";
}

/** OL marked the link expired, or the checkout expiry has passed while it was still unpaid. */
export function isCheckoutLinkExpired(
    payment: Pick<DealPaymentRequest, "ui_state" | "expires_at" | "ol_status">,
): boolean {
    if ((payment.ol_status ?? "").toLowerCase() === "expired") return true;
    if (!payment.expires_at) return false;
    const expires = Date.parse(payment.expires_at);
    if (Number.isNaN(expires) || expires > Date.now()) return false;

    return payment.ui_state === "pending_payment" || payment.ui_state === "failed";
}

/** A checkout URL the customer can still use. */
export function hasActiveCheckoutLink(payment: DealPaymentRequest): boolean {
    return Boolean(payment.show_checkout_url && payment.checkout_url) && !isCheckoutLinkExpired(payment);
}
