/**
 * Shapes returned by DashboardMetricsService, shared between the views and the
 * panels they compose.
 *
 * Nullable numbers are load-bearing: `null` means the data cannot support the
 * metric, `0` means it was measured as zero. The panels render those
 * differently on purpose.
 */

import type { Task } from "@/Types/api/tasks";
import type { DealFollowup } from "@/Types/api/deal-followup";

export interface RelatedRecord {
    type: "lead" | "deal";
    id: number;
    name: string;
}

/** A full task, so the row can open TaskDetailModal without a second fetch. */
export type QueueTask = Task & {
    days_overdue: number;
    related: RelatedRecord | null;
};

export interface ActionQueueData {
    overdueTasks: QueueTask[];
    hotLeads: Array<{
        id: number;
        client_name: string;
        temperature: string | null;
        waiting_hours: number;
    }>;
    stalledDeals: Array<{
        id: number;
        name: string;
        stage_name: string;
        days_in_stage: number;
        target_days: number;
    }>;
    /** Open records with no next-step task nominated. */
    noNextStep: Array<{
        type: "lead" | "deal";
        id: number;
        name: string;
        days_open: number;
    }>;
    /**
     * True totals. The row arrays above are capped, so anything showing "how
     * many" must read these — an agent with 85 overdue tasks must not be told
     * 25 because that is how many rows we chose to ship.
     */
    counts: {
        overdueTasks: number;
        hotLeads: number;
        stalledDeals: number;
        noNextStep: number;
    };
}

export interface AgentWeek {
    weekStart: string;
    meetings: number;
    dealsCreated: number;
    leadsContacted: number;
    /** null when no lead of theirs was both assigned and contacted this week. */
    medianResponseMinutes: number | null;
}

/**
 * A full follow-up, so the row can open MeetingDetailModal in place.
 *
 * `location_label` is a display string and deliberately NOT `location` — the
 * model's own `location` is the raw platform slug the meeting adapters switch
 * on, and overwriting it renders every meeting as "Physical".
 */
export type ScheduleEntry = DealFollowup & {
    title: string;
    subtitle: string | null;
    type: string | null;
    location_label: string | null;
    at: string | null;
    duration: number;
};

export interface CurrencyTotal {
    currency: string;
    total: number;
    deal_count: number;
}

export interface AgentPipeline {
    funnel: {
        pipelines: Array<{ id: number; name: string; deal_count: number }>;
        pipeline_id: number | null;
        stages: Array<{
            id: number;
            name: string;
            count: number;
            /** Days the deals currently in this stage have been here. */
            open_median_days: number | null;
            /** Historic transit time; null under three samples. */
            median_days: number | null;
            samples: number;
        }>;
    };
    value: CurrencyTotal[];
}

export interface Kpi {
    value: number | null;
    previous: number | null;
    spark: number[];
    unit?: string;
    note: string | null;
}

export type TeamKpis = Record<
    "newLeads" | "contactedInSla" | "meetings" | "dealsCreated" | "dealsWon",
    Kpi
>;

export interface LifecycleFunnel {
    days: number;
    steps: Array<{
        key: string;
        label: string;
        count: number;
        /** Share of this step that reached the next one. */
        to_next: number | null;
        median_days: number | null;
        dropped: number | null;
        drop_label: string | null;
    }>;
}

export interface ResponseDistribution {
    total: number;
    buckets: Array<{
        label: string;
        count: number;
        severity: "good" | "ok" | "warn" | "bad";
    }>;
    median_minutes: number | null;
    p90_minutes: number | null;
    /** Longest-waiting lead that still has no first contact. */
    worst_open_hours: number | null;
}

export interface SourceQualityRow {
    id: number;
    name: string;
    count: number;
    contacted: number;
    /** Absent on the leadership view, which doesn't query it. */
    won?: number;
}

export interface TeamAgentRow {
    agent_id: number;
    user_id: number | null;
    name: string;
    image: string | null;
    open_deals: number;
    leads: number;
    contact_rate: number | null;
    meetings: number;
    deals: number;
    won: number;
    sla_breaches: number;
    stalled_deals: number;
}

export interface TeamAgents {
    rows: TeamAgentRow[];
    median_contact_rate: number | null;
    sla_hours: number;
    stalled_total: number;
}

export interface PartnerStats {
    referredLeads: number;
    inProgressLeads: number;
    convertedLeads: number;
    conversionRate: number | null;
    medianDaysToClose: number | null;
    commissionsByStatus: Record<string, number>;
}

export interface PartnerForecast {
    deal_count: number;
    /** null when suppressed, or when the commission engine yields nothing. */
    amount: number | null;
    /** True when there are too few open deals to aggregate safely. */
    suppressed: boolean;
}

export interface PartnerTrendPoint {
    period: string;
    label: string;
    submitted: number;
    completed: number;
}

export interface PartnerReferral {
    id: number;
    client: string | null;
    stage: string;
    stalled: boolean;
    agent: string | null;
    days_open: number;
    idle_days: number;
    /** Null when this partner has no open flag on the referral. */
    flag_status: "open" | "acknowledged" | null;
    flag_response: string | null;
}

export interface PartnerFlagRow {
    id: number;
    partner: string | null;
    client: string | null;
    reason: string;
    message: string | null;
    status: string;
    days_open: number;
}
