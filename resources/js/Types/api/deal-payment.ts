export type DealPaymentUiState =
    | "pending_payment"
    | "bank_transfer_pending"
    | "processing_online"
    | "paid_online"
    | "confirmed"
    | "failed";

export interface DealPaymentVerifiedBy {
    id: number;
    name: string;
    email: string;
}

export interface DealPaymentRequest {
    id: number;
    deal_id: number;
    payment_id: string | null;
    amount: number;
    currency: string | null;
    currency_id: number | null;
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
    proof_url: string | null;
    updated_at: string | null;
    created_at: string | null;
}

export interface DealPaymentCreateInput {
    amount?: number;
    currency?: string;
    provider_key?: "manual-bank-transfer" | "nowpayments";
}

export interface DealPaymentResponse {
    status: string;
    data: DealPaymentRequest | null;
}
