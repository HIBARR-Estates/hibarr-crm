import { User } from "..";

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
}
