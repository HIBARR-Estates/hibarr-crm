import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { producesMeetingSummary } from "@/Components/Redesign/meeting/meetingFormUtils";

dayjs.extend(utc);

/**
 * - `ready`: there is a summary.
 * - `generating`: one can still be on its way.
 * - `stalled`: it should have arrived by now and has not.
 * - `none`: this meeting is not one that produces a summary.
 */
export type MeetingSummaryState = "ready" | "generating" | "stalled" | "none";

/**
 * How long after a meeting ends (or after the CRM last asked again) an
 * automatic summary is still expected. Recordings take a while to process,
 * but not forever — past this the page stops saying "generating" and says it
 * did not arrive, with a way forward. Before, the wait had no end: a summary
 * that never came was indistinguishable from one a minute away.
 */
export const SUMMARY_GRACE_MINUTES = 180;

const DEFAULT_DURATION_MINUTES = 30;

/**
 * Only the platforms `producesMeetingSummary` names can produce one.
 * Everything else shows neither the "View summary" link nor the "Generating…"
 * pill, because neither would ever resolve.
 */
export function meetingSummaryState(
    meeting: DealFollowup,
    bucket: "upcoming" | "live" | "past",
    now: dayjs.Dayjs = dayjs(),
): MeetingSummaryState {
    // A summary that exists is a summary, whatever kind of meeting it was.
    if (meeting.meeting_summary) return "ready";

    if (!producesMeetingSummary(meeting.location, meeting.meeting_link)) {
        return "none";
    }

    // A meeting that was cancelled, or that the client did not attend, has no
    // recording to summarise: it would otherwise read "generating" for ever.
    const status = (meeting.status ?? "").toLowerCase();
    if (
        status === "cancelled" ||
        status === "canceled" ||
        meeting.client_attended === false
    ) {
        return "none";
    }

    if (bucket !== "past") return "none";

    const ended = dayjs
        .utc(meeting.next_follow_up_date)
        .add(
            (meeting as { effective_duration?: number }).effective_duration ??
                meeting.duration ??
                DEFAULT_DURATION_MINUTES,
            "minute",
        );
    // Asking again restarts the wait from that moment.
    const asked = meeting.summary_retry_requested_at
        ? dayjs.utc(meeting.summary_retry_requested_at)
        : null;
    const waitingSince = asked && asked.isAfter(ended) ? asked : ended;

    return now.isBefore(waitingSince.add(SUMMARY_GRACE_MINUTES, "minute"))
        ? "generating"
        : "stalled";
}
