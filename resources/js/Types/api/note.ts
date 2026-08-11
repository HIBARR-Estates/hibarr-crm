import { User } from "..";

/** Null / omitted means created by a CRM user. */
export type ExternalSource = "meeting_bot" | "sally" | "max" | null;

export interface Note {
    id: number;
    deal_id: number;
    title: string;
    details: string;
    external_source?: ExternalSource | null;
    created_at: string;
    updated_at: string;
    added_by?: User;
}
