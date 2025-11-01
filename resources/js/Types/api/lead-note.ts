import { Note } from "./note";

export interface LeadNote extends Note {
    lead_id: number;
    is_lead_show: number;
    client_id?: number;
    member_id?: number;
    type: number;
    ask_password: number;
    addedBy?: {
        id: number;
        name: string;
        email: string;
        image_url?: string;
    };
    added_by_user?: {
        id: number;
        name: string;
        email: string;
        image_url?: string;
    };
}