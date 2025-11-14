export interface Activity {
    id: number;
    type?: string;
    timestamp: string;
    subject?: string;
    message?: string;
    message_content?: string;
    duration?: string;
    sender_name?: string;
    channel_type?: string;
    parent_activity_id?: number;
    chat_id?: string;
    deal_id?: number;
    lead_id?: number;
}
