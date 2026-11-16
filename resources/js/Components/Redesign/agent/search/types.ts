/** What the agent search returns (App\Services\AgentWorkspace\AgentSearch). */

export const SEARCH_GROUPS = ["people", "deals", "properties", "tasks", "meetings", "notes"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export interface PersonHit {
    id: number;
    name: string | null;
    status: string | null;
    status_color: string | null;
    phone: string;
    owner_id: number | null;
    owner_name: string | null;
    deals: number;
}

export interface DealHit {
    id: number;
    lead_id: number | null;
    name: string | null;
    person: string | null;
    pipeline: string | null;
    stage: string | null;
    stage_color: string | null;
    outcome: string | null;
    value: number | null;
    currency: string | null;
    agent_name: string | null;
    read_only: boolean;
    next_meeting_at: string | null;
}

export interface PropertyHit {
    id: number;
    title: string;
    project: string | null;
    developer: string | null;
    city: string | null;
    area: string | null;
    bedrooms: number | null;
    size_sqm: number | null;
    price: number | null;
    currency: string | null;
    construction_status: string | null;
    status: string | null;
}

export interface TaskHit {
    id: number;
    heading: string;
    due_date: string | null;
    related: { type: "lead" | "deal"; id: number; name: string; person?: string | null } | null;
}

export interface MeetingHit {
    id: number;
    title: string;
    person: string | null;
    type: string | null;
    at: string | null;
    duration: number | null;
    where: string | null;
    lead_id: number | null;
    deal_id: number | null;
}

export interface NoteHit {
    id: number;
    kind: "lead" | "deal";
    subject: string | null;
    snippet: string;
    at: string | null;
    lead_id: number | null;
    deal_id: number | null;
}

export interface SearchResults {
    query: string;
    counts: Record<SearchGroup, number>;
    total: number;
    groups: {
        people: PersonHit[];
        deals: DealHit[];
        properties: PropertyHit[];
        tasks: TaskHit[];
        meetings: MeetingHit[];
        notes: NoteHit[];
    };
}
