import { dayKeyIn } from "@/Components/Redesign/agent";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { QueueTask, RelatedRecord, ScheduleEntry } from "@/Types/personal-work";
import type { Task } from "@/Types/Task";

/**
 * Lead statuses past the lead's goal. A qualified lead's next steps live on
 * its deal, and a converted, lost or not-a-fit lead has none to keep.
 */
const LEAD_DONE = new Set(["qualified", "converted", "lost", "not_fit"]);

/** Whether a record still keeps a next step: an open deal, or a lead not yet qualified. */
export function wantsNextStep(record: RelatedRecord | null | undefined): record is RelatedRecord {
    if (!record) return false;
    if (record.type === "deal") return !record.outcome;
    return !LEAD_DONE.has(record.status_key ?? "");
}

export interface DoNextRequest {
    /** The deal or lead the next step is for. */
    record: RelatedRecord;
    /** What was just finished: "Done: …" for a task, "Held: …" for a meeting. */
    done?: { kind: "task" | "meeting"; label: string };
    /** The row to open under; none opens it as a dialog. */
    anchor: HTMLElement | null;
    /**
     * A meeting marked Attended from "Did these happen?": the prompt carries
     * its report and saves the outcome with it, whichever button closes it.
     */
    report?: { meetingId: number };
}

export type DoNextSaved = { kind: "task"; task: Task | undefined } | { kind: "meeting"; meeting: DealFollowup | undefined };

/** The row or card a button sits in, to open the prompt under it. */
export function rowOf(element: Element | null | undefined): HTMLElement | null {
    if (!element) return null;
    return (element.closest("li, article, [role='row'], section") as HTMLElement | null) ?? (element as HTMLElement);
}

/** "Call back about financing · Lukas Wagner". */
export function taskDoneLabel(task: Pick<QueueTask, "heading" | "related">): string {
    return [task.heading, task.related?.person ?? task.related?.name].filter(Boolean).join(" · ");
}

/** "Strategy · Sabine Krüger · Fri 6 Nov". */
export function meetingHeldLabel(
    meeting: Pick<ScheduleEntry, "type" | "person" | "title" | "at">,
    locale: string,
    timeZone: string,
): string {
    const day = meeting.at
        ? new Date(meeting.at).toLocaleDateString(locale || undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: timeZone || undefined,
          })
        : null;
    return [meeting.type, meeting.person ?? meeting.title, day].filter(Boolean).join(" · ");
}

/** Tomorrow in the agent's zone, as YYYY-MM-DD: where a next step lands by default. */
export function tomorrowIn(timeZone: string): string {
    return dayKeyIn(Date.now() + 86_400_000, timeZone);
}

/** "Lukas" from "Lukas Wagner". */
export function firstName(name: string | null | undefined): string {
    return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
