import type { LeadContactMethod } from "./leads";

export type LeadMergeOwnershipFieldKey =
    | "lead_owner"
    | "added_by"
    | "client_id"
    | "agent_id";

export interface LeadMergeSummary {
    id: number;
    client_name: string | null;
    client_email: string | null;
    mobile: string | null;
    cell: string | null;
    office: string | null;
    company_name: string | null;
    address: string | null;
    client_whatsapp: string | null;
    client_telegram: string | null;
    client_instagram: string | null;
    owner_name?: string | null;
    created_at?: string | null;
    contact_methods: LeadContactMethod[];
}

/** Which lead's value the kept lead ends up with. */
export type LeadMergeSide = "primary" | "duplicate";

export type LeadMergeFieldState = "same" | "fill" | "keep" | "choose" | "locked";

export interface LeadMergeFieldRow {
    /** Lead column, "custom:<id>" or "marketing:<column>". */
    key: string;
    /** English label (custom field labels are user-defined). */
    label: string;
    primary: string | null;
    duplicate: string | null;
    state: LeadMergeFieldState;
    default_pick: LeadMergeSide;
    hint: "kept_as_alternate" | "higher_score" | "touch_history" | "referrer_locked" | null;
    custom?: boolean;
}

export type LeadMergeGroupKey = "contact" | "personal" | "status" | "ownership" | "marketing" | "custom";

export interface LeadMergeFieldGroup {
    key: LeadMergeGroupKey;
    rows: LeadMergeFieldRow[];
}

export interface LeadMergeCombinedList {
    primary: string[];
    duplicate: string[];
    result: string[];
}

export interface LeadMergeCombinedValue {
    primary: string | null;
    duplicate: string | null;
    result: string | null;
}

export interface LeadMergeCombined {
    languages?: LeadMergeCombinedList;
    categories?: LeadMergeCombinedList;
    engagement?: Array<{ key: string; primary: boolean; duplicate: boolean; result: boolean }>;
    last_webinar_date?: LeadMergeCombinedValue;
}

export interface LeadMergeContactConflict {
    primary: string | number | null;
    duplicate: string | number | null;
}

export interface LeadMergeOwnershipField {
    field: LeadMergeOwnershipFieldKey;
    primary_value: number | null;
    primary_label: string | null;
    duplicate_value: number | null;
    duplicate_label: string | null;
    differs: boolean;
}

export interface LeadMergeConnectedCounts {
    deals: number;
    notes: number;
    follow_ups: number;
    qualifications: number;
    communication_activities: number;
    tasks: number;
    flight_itineraries: number;
}

export interface LeadMergeReviewResponse {
    status: "success";
    message: string;
    primary: LeadMergeSummary;
    duplicate: LeadMergeSummary;
    contact_conflicts: Record<string, LeadMergeContactConflict>;
    ownership_fields: LeadMergeOwnershipField[];
    counts: {
        primary: LeadMergeConnectedCounts;
        duplicate: LeadMergeConnectedCounts;
    };
    field_groups?: LeadMergeFieldGroup[];
    combined?: LeadMergeCombined;
    /** Records of each kind that move from the duplicate to the kept lead. */
    moves?: Record<string, number>;
}

export interface LeadDuplicateCandidate {
    id: number;
    client_name: string | null;
    client_email: string | null;
    mobile: string | null;
    cell: string | null;
    company_name: string | null;
    lead_owner: number | null;
    added_by: number | null;
}
