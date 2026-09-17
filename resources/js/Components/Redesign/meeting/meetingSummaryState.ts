import type { DealFollowup } from "@/Types/api/deal-followup";
import { producesMeetingSummary } from "@/Components/Redesign/meeting/meetingFormUtils";

export type MeetingSummaryState = "ready" | "generating" | "none";

/**
 * Only the platforms `producesMeetingSummary` names can produce one.
 * Everything else shows neither the "View summary" link nor the "Generating…"
 * pill, because neither would ever resolve.
 */
export function meetingSummaryState(
    meeting: DealFollowup,
    bucket: "upcoming" | "live" | "past",
): MeetingSummaryState {
    if (!producesMeetingSummary(meeting.location, meeting.meeting_link)) {
        return "none";
    }
    if (meeting.meeting_summary) return "ready";
    return bucket === "past" ? "generating" : "none";
}

