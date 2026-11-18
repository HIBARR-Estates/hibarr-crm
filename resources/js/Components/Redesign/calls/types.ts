export type CallRecordingState = "playable" | "processing" | "expired" | "restricted" | "failed" | "none";

/** One call, as App\Services\CallLog\CallLogService serialises it. */
export interface CallLogRecording {
    state?: CallRecordingState;
    error?: string | null;
    expired: boolean;
    expires_at: string | null;
    duration_seconds: number | null;
    /** false: the viewer may not play it (links below are then null). */
    can_play: boolean;
    id: number | null;
    filename: string | null;
    play_url: string | null;
    download_url: string | null;
    /** Set for WebM recordings, which open in Bunny's player in a new tab. */
    open_url?: string | null;
}

export type CallOutcome =
    | "started"
    | "ended"
    | "missed"
    | "declined"
    | "voicemail"
    | "busy"
    | "failed";

export interface CallLogRow {
    id: number;
    occurred_at: string | null;
    outcome: CallOutcome | string;
    direction: "inbound" | "outbound" | null;
    phone_number: string | null;
    duration: number | null;
    user_id: number | null;
    user_name: string | null;
    entity_type: "lead" | "deal" | null;
    entity_id: number | null;
    entity_name: string | null;
    entity_url: string | null;
    failure_reason: string | null;
    failure_message: string | null;
    routing_reason: string | null;
    is_forwarded: boolean;
    forwarded_from_user_id: number | null;
    forwarded_from_user_name: string | null;
    has_recording: boolean;
    recording: CallLogRecording | null;
    /** When the call first reached the CRM (same as occurred_at). */
    started_at?: string | null;
    ended_at?: string | null;
    /** Someone took the call (it connected or is live). */
    answered?: boolean;
    answered_by_user_id?: number | null;
    answered_by_user_name?: string | null;
    /** Every agent the call rang, in the order it reached them. */
    legs?: CallLeg[];
    rang_count?: number;
    /** The timeline events folded into this row. */
    event_ids?: number[];
}

/** One agent's leg of a call (a ring group rings several agents at once). */
export interface CallLeg {
    user_id: number;
    user_name: string | null;
    /** How this agent's leg ended: ended/started = answered, declined = passed. */
    outcome: CallOutcome | string;
    at: string | null;
}

export interface CallLogSummary {
    total: number;
    connected: number;
    connected_seconds: number;
    missed: number;
    with_recording: number;
    unlinked: number;
    last_at: string | null;
}

export interface CallLogResponse {
    status: string;
    data: CallLogRow[];
    meta: { page: number; per_page: number; total: number; last_page: number };
    /** Lead endpoint only. */
    summary?: CallLogSummary;
}

export interface CallLogFilters {
    direction?: "inbound" | "outbound" | "";
    outcome?: CallOutcome | "";
    user_id?: number | "";
    search?: string;
    from?: string;
    to?: string;
    has_recording?: boolean;
    unlinked?: boolean;
}
