export type DealPaymentUiState =
    | "pending_payment"
    | "bank_transfer_pending"
    | "processing_online"
    | "paid_online"
    | "confirmed"
    | "failed"
    | "invalidated";

export interface DealPaymentVerifiedBy {
    id: number;
    name: string;
    email: string;
}

export interface DealPaymentRequest {
    id: number;
    deal_id: number;
    payment_id: string | null;
    /** In the request's own currency — what the client is asked to pay. */
    amount: number;
    currency: string | null;
    currency_symbol: string | null;
    currency_id: number | null;
    /** The deal value (company currency) the amount was converted from. */
    base_amount: number | null;
    base_currency: string | null;
    base_currency_symbol: string | null;
    /** 1 base_currency = rate currency. */
    rate: number | null;
    gateway: string | null;
    crm_status: string;
    ol_status: string | null;
    ol_payment_type: string | null;
    ui_state: DealPaymentUiState;
    can_confirm: boolean;
    show_checkout_url: boolean;
    checkout_url: string | null;
    expires_at: string | null;
    verified_by_user_id: number | null;
    verified_by: DealPaymentVerifiedBy | null;
    verified_at: string | null;
    invalidated_at: string | null;
    invalidation_reason: string | null;
    proof_url: string | null;
    updated_at: string | null;
    created_at: string | null;
}

export interface DealPaymentCreateInput {
    /** ISO code; the server converts the deal value into it at the live rate. */
    currency: string;
    /** Optional. Omit so OL checkout lets the client choose how to pay. */
    provider_key?: "manual-bank-transfer" | "nowpayments";
}

/** A deal's current request plus its full history, newest first. */
export interface DealPaymentState {
    active: DealPaymentRequest | null;
    requests: DealPaymentRequest[];
}

export interface DealPaymentResponse {
    status: string;
    data: DealPaymentRequest | null;
    message?: string;
}

/** Error `code` returned by value-writing endpoints (see DealPaymentValueGuard). */
export const PAYMENT_INVALIDATION_REQUIRED = "payment_request_invalidation_required";

/** Request flag that accepts invalidating the unpaid payment request. */
export const PAYMENT_INVALIDATION_FLAG = "invalidate_payment_request";
