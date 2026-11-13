/**
 * One person's own work, as DashboardMetricsService returns it: the task queue
 * rows and the meetings on their schedule. Shared by the personal dashboard and
 * Today in the agent workspace, which read the same service.
 */

import type { Task } from "@/Types/api/tasks";
import type { DealFollowup } from "@/Types/api/deal-followup";

/** The lead or deal a task hangs off. */
export interface RelatedRecord {
    type: "lead" | "deal";
    id: number;
    name: string;
    /** The lead's lifecycle status, or the deal's stage. */
    status?: string | null;
    /** The status's own colour (the lifecycle status's or the stage's), when it has one. */
    status_color?: string | null;
    /** The person: the lead itself, or the deal's contact. */
    person?: string | null;
    /** The person's mobile with its country code, when there is one. */
    phone?: string | null;
}

/** A full task, so the row can open TaskDetailModal without a second fetch. */
export type QueueTask = Task & {
    days_overdue: number;
    related: RelatedRecord | null;
};

/**
 * A full follow-up, so the row can open MeetingViewModal in place.
 *
 * `location_label` is a display string and deliberately NOT `location` — the
 * model's own `location` is the raw platform slug the meeting adapters switch
 * on, and overwriting it renders every meeting as "Physical".
 */
export type ScheduleEntry = DealFollowup & {
    title: string;
    subtitle: string | null;
    type: string | null;
    /** Who the meeting is with: the lead, or the deal's contact. */
    person?: string | null;
    /** The deal's pipeline stage name, when the meeting is on a deal. */
    deal_stage?: string | null;
    location_label: string | null;
    at: string | null;
    duration: number;
};
