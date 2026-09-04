/**
 * Shapes the personal dashboard's own endpoints return.
 *
 * Everything shared with the role-scoped views (QueueTask, ScheduleEntry, …)
 * lives in ../types and is imported from there — these are only the payloads
 * DashboardMetricsService added for this page.
 */

import type { QueueTask } from "../types";

/**
 * Due-window severity. Deliberately not the ../types Severity, which mixes
 * windows with reasons ("hot", "stalled") — this page ranks by lateness only.
 */
export type Severity = "now" | "soon" | "watch";

export interface PersonalQueue {
    /** Capped rows. Anything showing "how many" must read `counts`. */
    tasks: QueueTask[];
    /** True totals, uncapped. */
    counts: { overdue: number; today: number; later: number };
    /** Open records nobody nominated a next step on — the queue's footer line. */
    uncovered: { leads: number; deals: number };
}

export interface CurrencyTotal {
    currency: string;
    total: number;
}

export interface PipelineRow {
    id: number;
    name: string;
    deal_count: number;
    /** Deals untouched for a week. */
    idle_count: number;
    /** Split by currency, company default first — the stored rates can't be trusted, so totals aren't ranked by amount. */
    totals: CurrencyTotal[];
}

export interface PersonalStats {
    leads: { new: number; contacted: number; uncontacted: number };
    meetings: {
        /** Booked ahead, inside the window — not yet happened. */
        upcoming: number;
        /** Logged attendance_outcome = attended, inside the window behind. */
        attended: number;
        /** Logged attendance_outcome = no_show, inside the window behind. */
        missed: number;
    };
}

/**
 * Commission for this account, or null when it holds no lead_agent record —
 * which is most employees — or the company has no default currency. The tile
 * is dropped rather than zeroed.
 *
 * Unlike deal value, always a single entry in the company's own currency
 * (empty array when that bucket is zero) — commission is never split across
 * currencies. System-type legs (the house's cut) are already excluded.
 */
export interface CommissionSummary {
    earned: CurrencyTotal[];
    previous: CurrencyTotal[];
    pending: CurrencyTotal[];
}

