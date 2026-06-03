import { User } from "..";
import { Deal } from "./deals";

export interface Reminder {
    time: number;
    type: "minute" | "hour" | "day";
    is_default?: boolean;
}

export interface MeetingSummary {
    id: number;
    deal_id: number;
    meeting_type_id?: number;
    summary_object: Record<string, string>;
    created_at: string;
    updated_at: string;
}

export interface DealFollowup {
    id: number;
    lead_id?: number | null;
    deal_id?: number | null;
    next_follow_up_date: string;
    duration?: number | null; // Meeting duration in minutes
    meeting_link: string;
    status: string;
    location: string;
    created_at: string;
    updated_at: string;
    summary_id?: number;
    added_by?: User;
    meeting_type?: {
        id: number;
        name: string;
    };
    remark?: string;
    reminders?: Reminder[];
    participants?: number[]; // Array of user IDs
    meeting_summary?: MeetingSummary;
    deal?: Pick<Deal, "id" | "name"> | Deal;
    effective_duration?: number; // Computed: duration ?? 30
    participant_users?: {
        id: number;
        name: string;
        image?: string;
        email?: string;
        image_url?: string;
    }[]; // Resolved from participants IDs
}

/** Paginated response shape for meetings (Laravel paginator) */
export interface PaginatedFollowupResponse {
    current_page: number;
    data: DealFollowup[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}
