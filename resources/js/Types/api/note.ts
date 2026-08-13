import { User } from "..";

/** Null / omitted means created by a CRM user. */
export type IntegrationOrigin = "meeting_bot" | "sally" | "max" | null;

export interface Note {
    id: number;
    deal_id: number;
    title: string | null;
    details: string;
    integration_origin?: IntegrationOrigin | null;
    created_at: string;
    updated_at: string;
    added_by?: User;
}
