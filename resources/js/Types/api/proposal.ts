export interface Currency {
    id: number;
    currency_symbol: string;
    currency_code: string;
}

export interface ProposalSignature {
    id: number;
    proposal_id: number;
    full_name: string;
    email: string;
    signature: string;
    created_at: string;
    updated_at: string;
}

export interface ProposalAddedBy {
    id: number;
    name: string;
    image?: string;
}

export interface Proposal {
    id: number;
    deal_id: number;
    proposal_number: string;
    original_proposal_number: string;
    valid_till: string;
    unit_id?: number;
    sub_total: number;
    total: number;
    currency_id?: number;
    discount_type: string;
    discount: number;
    invoice_convert: number;
    status: "waiting" | "accepted" | "declined";
    send_status: number;
    ip_address: string;
    note?: string;
    description?: string;
    last_viewed?: string;
    created_at: string;
    updated_at: string;
    client_comment?: string;
    signature_approval: number;
    added_by?: number;
    last_updated_by?: number;
    hash?: string;
    calculate_tax: string;
    company_id?: number;

    // Relationships
    currency?: Currency;
    signature?: ProposalSignature;
    addedBy?: ProposalAddedBy;
}
