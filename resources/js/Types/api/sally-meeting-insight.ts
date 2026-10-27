export interface SallyTranscriptSegment {
    id?: string | null;
    text: string;
    speakerName?: string | null;
    startTime?: number | null;
    endTime?: number | null;
    sortOrder?: number | null;
}

/** Sally's generated note kinds (mirrors SallyMeetingInsight::SUGGESTION_TYPES). */
export type SallySuggestionType =
    | "objection"
    | "decision"
    | "insight"
    | "meeting_type";

export interface SallySuggestedNote {
    /** OL-stable id — the logged/unlogged state hangs off it. */
    id: string;
    type: SallySuggestionType;
    /** Working copy: Sally's text until an agent edits it. */
    text: string;
    /** Agent rewrote the text before logging (a re-sync then leaves it alone). */
    edited: boolean;
    /** True once the suggestion was logged as a CRM note. */
    logged: boolean;
    /** "as_is" — logged verbatim; "after_edit" — logged with the agent's text. */
    logged_mode?: "as_is" | "after_edit" | null;
    logged_at?: string | null;
    logged_by?: number | null;
    logged_note_id?: number | null;
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
    /** Link to the meeting recording; opens in a new tab. Hidden when absent. */
    recording_url?: string | null;
    /**
     * Sally's suggested notes with their logging state. These are working
     * copies — Sally's originals (`original_*`) are API-only, agents never
     * see them in the UI.
     */
    suggested_notes?: SallySuggestedNote[];
    /** Sally's original summary, as first received. API-only — agents never see it. */
    original_summary?: string | null;
    /** Sally's original bullet points, as first received. API-only. */
    original_bullet_points?: string[] | null;
    /**
     * Sally's original suggested notes, as first received. Parallel to
     * `suggested_notes` (same order, same ids); the working copy may have
     * been edited or logged. API-only.
     */
    original_suggested_notes?: SallySuggestedNoteOriginal[];
    /** Set once an agent edited the field; a re-sync then leaves it alone. */
    summary_edited_at?: string | null;
    bullet_points_edited_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    meeting?: SallyMeetingInsightMeeting | null;
}

/** Sally's original suggestion, before any agent edit. API-only. */
export interface SallySuggestedNoteOriginal {
    id: string;
    type?: SallySuggestionType | null;
    text: string;
}
