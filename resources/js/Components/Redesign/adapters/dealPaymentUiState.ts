import type { DealPaymentUiState } from "@/Types/api/deal-payment";
import type { BadgeVariant } from "../primitives/Badge";

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

export function paymentUiStateBadgeVariant(uiState: DealPaymentUiState): BadgeVariant {
    switch (uiState) {
        case "pending_payment":
            return "amber";
        case "bank_transfer_pending":
            return "blue";
        case "processing_online":
            return "navy";
        case "paid_online":
            return "green";
        case "confirmed":
            return "green";
        case "failed":
            return "red";
        default:
            return "gray";
    }
}
