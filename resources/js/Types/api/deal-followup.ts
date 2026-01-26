import { User } from "..";

export interface Reminder {
    time: number;
    type: 'minute' | 'hour' | 'day';
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
    deal_id: number;
    next_follow_up_date: string;
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
}
