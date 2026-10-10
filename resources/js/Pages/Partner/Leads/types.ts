/** Shapes returned by PartnerLeadController. No contact fields exist here on purpose. */

export interface LeadStatus {
    label: string;
    color: string | null;
}

export interface DealStage {
    name: string;
    color: string | null;
}

export interface PartnerLeadRow {
    id: number;
    /** Abbreviated, e.g. "S. Al-Rashid". */
    name: string | null;
    status: LeadStatus | null;
    created_at: string | null;
    active_deals: number;
    active_deal_statuses: DealStage[];
}

export interface PartnerLeadsPage {
    data: PartnerLeadRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface CurrencyRef {
    code: string | null;
    symbol: string | null;
}

export interface PartnerDealRow {
    id: number;
    name: string | null;
    /** A pipeline stage name while open; "won" or "lost" once closed. */
    status: string;
    status_color: string | null;
    value: number;
    currency: CurrencyRef;
    date: string | null;
}

export interface PartnerLeadTotal extends CurrencyRef {
    amount: number;
}

export interface PartnerLeadDetail {
    id: number;
    name: string | null;
    status: LeadStatus | null;
    active_deals: PartnerDealRow[];
    closed_deals: PartnerDealRow[];
    /** Open plus won deals, per currency. Lost deals are listed, not counted. */
    totals: PartnerLeadTotal[];
}
