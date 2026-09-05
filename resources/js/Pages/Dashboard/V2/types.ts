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

// ── Team (downline) view ─────────────────────────────────────────

/**
 * Commission figures are plain numbers in the company's own currency, not the
 * CurrencyTotal[] split deal value uses: MlmCommissionService converts a deal
 * through its snapshotted exchange rate before writing a leg, so a commission
 * is never split across currencies. `currency` is null when the company has no
 * default currency configured — the panels then render bare numbers rather
 * than stamping the wrong symbol on them.
 */
export interface DownlineMoney {
    /** Paid inside the selected window, by paid_at. */
    paid: number;
    /** Standing balance — deliberately not windowed. */
    pending: number;
}

export interface DownlineSummary extends DownlineMoney {
    /** Size of the tree below the viewer. Excludes the viewer themselves. */
    agents: number;
    direct_reports: number;
    /** Deepest generation reached, 0 when nobody reports to them. */
    generations: number;
    root: { agent_id: number; name: string | null; level: string | null };
    deals_won: number;
    currency: string | null;
    days: number;
}

/** Fields both rollup tables carry about the forecast they show. */
interface DownlineForecastMeta {
    currency: string | null;
    /** True when more open deals exist than the forecast priced. */
    forecast_truncated: boolean;
    /** How many open deals the forecast actually covers. */
    forecast_deals: number;
    days: number;
}

export interface DownlineLevelRow extends DownlineMoney {
    /** 0 is the viewer, 1 their direct reports, 2 those agents' reports. */
    depth: number;
    agents: number;
    deals_won: number;
    deals_open: number;
    forecast: number;
}

export interface DownlineLevels extends DownlineForecastMeta {
    rows: DownlineLevelRow[];
}

export interface DownlineAgentRow extends DownlineMoney {
    agent_id: number;
    user_id: number | null;
    name: string;
    image: string | null;
    depth: number;
    parent_agent_id: number | null;
    /** MLM level name, null for an agent who has never been assigned one. */
    level: string | null;
    direct_reports: number;
    deals_won: number;
    deals_open: number;
    forecast: number;
}

export interface DownlineAgents extends DownlineForecastMeta {
    rows: DownlineAgentRow[];
}
