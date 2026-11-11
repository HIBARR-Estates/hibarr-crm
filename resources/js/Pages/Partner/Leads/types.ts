/** Shapes returned by PartnerLeadController. Email and phone are never on these shapes. */

export interface LeadStatus {
    id: number;
    label: string;
    color: string | null;
}

export interface PartnerLeadRow {
    id: number;
    /** Full client name. */
    name: string | null;
    /** First-touch UTM source when the lead has one, otherwise the lead source. */
    source: string | null;
    /** Lead source, only when it differs from `source`. */
    lead_source: string | null;
    status: LeadStatus | null;
    created_at: string | null;
    /** Deals by outcome — open, won or lost — never by pipeline stage. */
    deals: DealCounts;
}

export interface DealCounts {
    open: number;
    won: number;
    lost: number;
}

export interface PartnerLeadOptions {
    /** Lifecycle statuses the partner's own leads actually have. */
    statuses: LeadStatus[];
}

export interface PartnerLeadsPage {
    data: PartnerLeadRow[];
    options: PartnerLeadOptions;
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
    /** "open", "won" or "lost". Pipeline stages differ per pipeline, so they are not shown. */
    status: "open" | "won" | "lost";
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
    /** First-touch UTM source when the lead has one, otherwise the lead source. */
    source: string | null;
    /** Lead source, only when it differs from `source`. */
    lead_source: string | null;
    status: LeadStatus | null;
    active_deals: PartnerDealRow[];
    closed_deals: PartnerDealRow[];
    /** Open plus won deals, per currency. Lost deals are listed, not counted. */
    totals: PartnerLeadTotal[];
}
