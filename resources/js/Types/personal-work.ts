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
    location_label: string | null;
    at: string | null;
    duration: number;
};
