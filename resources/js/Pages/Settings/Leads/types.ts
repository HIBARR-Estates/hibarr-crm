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
