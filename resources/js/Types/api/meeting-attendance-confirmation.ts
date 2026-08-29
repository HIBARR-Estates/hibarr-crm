export type MeetingAttendanceOutcome =
    | "attended"
    | "no_show"
    | "rescheduled"
    | "cancelled"
    | "partial";

export interface PendingMeetingAttendanceParticipant {
    id: number;
    name: string;
    email?: string;
    image_url?: string;
}

export interface PendingMeetingAttendanceConfirmation {
    id: number;
    deal_id: number | null;
    lead_id: number | null;
    contact_name: string | null;
    meeting_type_label: string | null;
    scheduled_at: string | null;
    duration: number;
    location: string | null;
    meeting_link: string | null;
    remark: string | null;
    participants: PendingMeetingAttendanceParticipant[];
}

export interface MeetingAttendanceConfirmationPayload {
    outcome: MeetingAttendanceOutcome;
    note?: string | null;
}
