export interface SlaSettings {
    first_contact_sla_hours: number;
    min_hours: number;
    max_hours: number;
    default_hours: number;
}

export interface LeadSourceRow {
    id: number;
    type: string;
    sort_order: number;
    added_by: number | null;
}

export interface LeadSourcePermissions {
    add: boolean;
    edit: string;
    delete: string;
    reorder: boolean;
}

export interface LeadStatusRow {
    id: number;
    key: string;
    label: string;
    description: string | null;
    sort_order: number;
    label_color: string;
    leads_count: number;
    is_system: boolean;
    is_default: boolean;
}

export interface LeadStatusDraft {
    key: string;
    label: string;
    description: string;
    label_color: string;
    sort_order: number;
}
