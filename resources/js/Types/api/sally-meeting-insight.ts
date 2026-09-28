export interface SallyTranscriptSegment {
    id?: string | null;
    text: string;
    speakerName?: string | null;
    startTime?: number | null;
    endTime?: number | null;
    sortOrder?: number | null;
}

export interface SallyMeetingInsightMeeting {
    id: number;
    remark?: string | null;
    next_follow_up_date?: string | null;
    location?: string | null;
    /** IANA zone the meeting was booked in, so the card matches the Meetings tab. */
    timezone?: string | null;
}

export interface SallyMeetingInsightPayload {
    summary?: string | null;
    transcript?: string | null;
    transcript_segments?: SallyTranscriptSegment[];
    bullet_points: string[];
}

export interface SallyMeetingInsight {
    id: number;
    meeting_id: number;
    lead_id?: number | null;
    deal_id?: number | null;
    summary?: string | null;
    /** Full transcript as plain text (speaker lines joined). */
    transcript?: string | null;
    transcript_segments?: SallyTranscriptSegment[];
    bullet_points: string[];
    /** Grouped insight fields (mirrors write API `payload`). */
    payload?: SallyMeetingInsightPayload;
    created_at?: string | null;
    updated_at?: string | null;
    meeting?: SallyMeetingInsightMeeting | null;
}
