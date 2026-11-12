export type DealPaymentUiState =
    | "pending_payment"
    | "cash_pending"
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
    /** ISO code; the server converts the requested company-currency amount into it. */
    currency: string;
    /**
     * Company-currency slice of the deal to request. Omit to request whatever
     * confirmed payments have not covered. Cannot exceed that remainder.
     */
    base_amount?: number;
    /**
     * Units of `currency` per 1 company-currency unit. Omit to use the live
     * rate. Ignored when `currency` is already the company currency.
     */
    exchange_rate?: number;
    /**
     * Optional. Omit so checkout lets the client choose how to pay.
     * `cash` is recorded in the CRM and is not sent to the payment service.
     */
    provider_key?: "manual-bank-transfer" | "nowpayments" | "cash";
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
