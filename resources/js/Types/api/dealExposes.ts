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
    /** Present only on the lead rollup — false elsewhere (deal_id's own page already knows its lock state). */
    deal_is_locked: boolean;
    lead_id: number | null;
    source: DealExposeSource;
    expose_snapshot_id: number | null;
    /** Set only when source is "linked" — the referenced property/project/unit type. */
    entity_type: "property" | "developer_project" | "unit_type" | null;
    entity_id: number | null;
    unit_type_id: number | null;
    title: string;
    source_label: string | null;
    amount: number | string | null;
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

/**
 * A property / developer project / unit type that can be linked to a deal.
 * Picking one and submitting just records a reference to it on the
 * DealExpose row — no document or ExposeSnapshot is generated.
 */
export interface DealExposeLinkableEntity {
    entity_type: "property" | "developer_project" | "unit_type";
    entity_id: number;
    /** Present only when entity_type is "unit_type" — the unit type's own id. */
    unit_type_id: number | null;
    entity_label?: string;
    title: string;
    suggested_amount?: number | null;
    /** Cover/thumbnail photo URL, or null when the entity has none uploaded. */
    cover_image: string | null;
}

export interface DealExposesResponse {
    status: string;
    exposes: DealExpose[];
    summary: DealExposeSummary;
}
