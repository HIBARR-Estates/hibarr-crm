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
