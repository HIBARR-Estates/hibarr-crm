/**
 * Exposes attached to a deal — documents shown to a buyer, each carrying an
 * amount and a status lifecycle. Distinct from `offers.ts`
 * (DealOfferApplication), which models price discounts applied to a deal.
 */

export type DealExposeStatus =
    | "not_sent"
    | "shown"
    | "accepted"
    | "not_accepted";

export type DealExposeSource = "linked" | "manual";

export interface DealExpose {
    id: number;
    deal_id: number;
    /** Present only on the lead rollup, where rows are grouped by deal. */
    deal_name: string | null;
    lead_id: number | null;
    source: DealExposeSource;
    expose_snapshot_id: number | null;
    title: string;
    source_label: string | null;
    amount: number | null;
    status: DealExposeStatus;
    status_changed_at: string | null;
    filename: string | null;
    download_url: string | null;
    size: number | null;
    created_at: string | null;
}

export interface DealExposeSummary {
    total: number;
    not_sent: number;
    shown: number;
    accepted: number;
    not_accepted: number;
}

export interface DealExposesResponse {
    status: string;
    exposes: DealExpose[];
    summary: DealExposeSummary;
}
