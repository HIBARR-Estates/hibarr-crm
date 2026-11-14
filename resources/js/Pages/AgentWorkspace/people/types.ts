import type { Lead } from "@/Types/api/leads";

export type { Lead };

/** Next-action buckets the People chips filter by (LeadService::NEXT_ACTION_BUCKETS). */
export type PeopleBucket = "overdue" | "today" | "week" | "none";

export interface PeopleCounts {
    all: number;
    overdue: number;
    today: number;
    week: number;
    none: number;
}

export interface LifecycleStatus {
    id: number;
    key: string;
    label: string;
    label_color?: string | null;
}

export interface RowDeal {
    id: number;
    name: string | null;
    stage: string | null;
    stage_color: string | null;
}

/** Per person, keyed by lead id (LeadContactController@agentIndex, `rowExtras`). */
export interface RowExtras {
    deals: RowDeal[];
    /** The latest CRM event on the person: the contact page's Last touches stream. */
    last_touch_at: string | null;
}

export type RowExtrasMap = Record<number, RowExtras>;

export interface PeoplePage {
    data: Lead[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export type PeopleFilters = Record<string, string | string[] | undefined>;
