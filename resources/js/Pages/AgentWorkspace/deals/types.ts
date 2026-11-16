/** One open deal, as the Deals page ships it (DealController@agentIndex). */
export interface DealItem {
    id: number;
    name: string | null;
    lead_id: number | null;
    stage_id: number;
    /** The person the deal is with. */
    person: string | null;
    value: number;
    /** The deal's own currency symbol; the company default when missing. */
    currency: string | null;
    locked: boolean;
    created_at: string | null;
    agent_id: number | null;
    agent_name: string | null;
    added_by: number | null;
    /** ISO time of the next meeting that has not happened yet. */
    next_meeting_at: string | null;
}

export interface DealStage {
    id: number;
    name: string;
    color: string | null;
    deals_count: number;
    total_value: number;
}

/** What is worked out for a deal after the page paints. */
export interface DealExtras {
    conditions: { met: number; total: number };
    last_activity_at: string | null;
}

export type DealExtrasMap = Record<number, DealExtras>;

export interface MonthOutcome {
    count: number;
    value: number;
}

export type DealsChip = "idle" | "meeting" | "ready";
export type DealsLayout = "board" | "list";

/** A deal with everything the card and the row show, worked out once. */
export interface DealView {
    deal: DealItem;
    extras: DealExtras | undefined;
    /** Whole days without activity once the extras are in; null before that. */
    idleDays: number | null;
    meetingWithinWeek: boolean;
    ready: boolean;
}
