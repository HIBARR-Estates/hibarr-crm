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
    created_at: string;
    updated_at: string;
    added_by?: number;
    last_updated_by?: number;
    file_url: string;
    icon: string;
}
