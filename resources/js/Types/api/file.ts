export interface DealFile {
    id: number;
    deal_id: number;
    user_id: number;
    filename: string;
    hashname: string;
    size: string;
    description?: string;
    google_url?: string;
    dropbox_link?: string;
    external_url?: string;
    object_path?: string;
    created_at: string;
    updated_at: string;
    added_by?: number;
    last_updated_by?: number;
    file_url: string;
    icon: string;
}

/** Freeform attachment on a lead contact (lead_contact_files). */
export interface LeadContactFile {
    id: number;
    lead_id: number;
    user_id: number;
    filename: string;
    hashname: string;
    size: string;
    description?: string;
    external_url?: string;
    object_path?: string;
    created_at: string;
    updated_at: string;
    added_by?: number;
    last_updated_by?: number;
    file_url: string;
    icon: string;
}
