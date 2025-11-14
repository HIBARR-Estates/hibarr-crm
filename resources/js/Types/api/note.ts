import { User } from "..";

export interface Note {
    id: number;
    deal_id: number;
    title: string;
    details: string;
    created_at: string;
    updated_at: string;
    added_by?: User;
}
