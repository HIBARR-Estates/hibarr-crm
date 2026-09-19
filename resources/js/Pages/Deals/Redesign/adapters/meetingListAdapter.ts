import type { DealFollowup } from "@/Types/api/deal-followup";
import { producesMeetingSummary } from "@/Components/Redesign/meeting/meetingFormUtils";
import {
    toWorkspaceMeetingPreview,
    type WorkspaceMeetingPreview,
} from "./meetingAdapter";
import { formatUserTime } from "@/lib/userDateTime";
import { formatMeetingTimeRange } from "@/Pages/Meetings/Redesign/adapters/meetingTimeLabel";

export type MeetingSummaryStatus = "available" | "pending" | "none";

/**
 * Status → pill tone. Shared by the meetings list and the detail modal so the
 * two can't drift. Tones are semantic: green = done, red = cancelled (a
 * negative outcome, not a neutral one), blue = still ahead of you.
 */
export function getMeetingStatusTone(status: string): string {
    if (status === "completed") return "dr-pill-green";
    if (status === "canceled" || status === "cancelled") return "dr-pill-red";
    if (status === "scheduled") return "dr-pill-blue";
    return "dr-pill-gray";
}

export interface MeetingStatusDisplay {
    /** Plain-English word — no reader should have to guess what a bare "scheduled" on a meeting that already happened means. */
    label: string;
    tone: string;
    dotColor: string;
}

/**
 * A clearer read on `status` than the raw DB value on its own.
 *
 * `status` only ever holds scheduled/completed/cancelled — a follow-up that
 * has already happened and nobody has reported on yet is *still* "scheduled"
 * in the database, which reads as "this hasn't happened" to anyone looking
 * at the word alone. Folding in whether the slot has actually passed turns
 * that into "Awaiting outcome", the same distinction the meetings list's row
 * chip already makes.
 */
export function getMeetingStatusDisplay(
    item: Pick<WorkspaceMeetingPreview, "isPast" | "isLive"> & {
        statusLabel: string;
    },
): MeetingStatusDisplay {
    if (item.statusLabel === "completed") {
        return { label: "Completed", tone: "dr-pill-green", dotColor: "#177a5b" };
    }
    if (item.statusLabel === "canceled" || item.statusLabel === "cancelled") {
        return { label: "Cancelled", tone: "dr-pill-red", dotColor: "#b91c1c" };
    }
    if (item.isLive) {
        return { label: "Live", tone: "dr-pill-red", dotColor: "#dc2626" };
    }
    if (item.isPast) {
        return { label: "Awaiting outcome", tone: "dr-pill-gray", dotColor: "#9ca3af" };
    }
    return { label: "Upcoming", tone: "dr-pill-blue", dotColor: "#14538c" };
}

export interface WorkspaceMeetingListItem extends WorkspaceMeetingPreview {
    endTimeLabel: string;
    timeRangeLabel: string;
    durationMinutes: number;
    platformLabel: string;
    platformBadgeVariant: "blue" | "green" | "gray";
    locationDisplay: string;
    meetingLink: string | null;
    summaryStatus: MeetingSummaryStatus;
    /** Meeting has actually happened — gates the AI-summary badge. */
    isConcluded: boolean;
    statusLabel: string;
    typeColor: string | null;
    followup: DealFollowup;
}

function getPlatformMeta(location?: string | null): {
    label: string;
    variant: "blue" | "green" | "gray";
    locationType: "video" | "in_person" | "phone";
} {
    switch (location) {
        case "zoho":
        case "zoho_meet":
            return {
                label: "Zoho Meeting",
                variant: "blue",
                locationType: "video",
            };
        case "google_meet":
        case "meet":
            return {
                label: "Google Meet",
                variant: "blue",
                locationType: "video",
            };
        case "zoom":
            return { label: "Zoom", variant: "blue", locationType: "video" };
        case "teams":
            return {
                label: "Microsoft Teams",
                variant: "blue",
                locationType: "video",
            };
        case "physical":
            return {
                label: "Physical",
                variant: "green",
                locationType: "in_person",
            };
        case "phone":
            return { label: "Phone", variant: "gray", locationType: "phone" };
        case "office":
            return {
                label: "HIBARR HQ",
                variant: "green",
                locationType: "in_person",
            };
        default:
            // Free-text physical place (Other location).
            if (location && location.trim()) {
                return {
                    label: "Physical",
                    variant: "green",
                    locationType: "in_person",
                };
            }
            return {
                label: "Meeting",
                variant: "gray",
                locationType: "in_person",
            };
    }
}

function getSummaryStatus(meeting: DealFollowup): MeetingSummaryStatus {
    // See producesMeetingSummary for which platforms qualify. This used to
    // accept any video platform with a link, which left Teams meetings
    // advertising a summary that was never coming.
    if (!producesMeetingSummary(meeting.location, meeting.meeting_link)) {
        return "none";
    }

    if (meeting.meeting_summary) {
        return "available";
    }

    return "pending";
}

function getLocationDisplay(
    meeting: DealFollowup,
    locationType: "video" | "in_person" | "phone",
): string {
    const link = meeting.meeting_link?.trim();
    if (locationType === "video" && link) {
        return link;
    }

    switch (meeting.location) {
        case "office":
            return "HIBARR HQ";
        case "phone":
            return "Phone meeting";
        case "physical":
            return "Physical meeting";
        case "zoho":
        case "zoho_meet":
            return "Zoho Meeting (link pending)";
        case "google_meet":
        case "meet":
            return "Google Meet";
        case "zoom":
            return "Zoom";
        case "teams":
            return "Microsoft Teams";
        default:
            return meeting.location || "No location set";
    }
}

/**
 * Whether the location line says anything the platform pill doesn't.
 *
 * The pill answers "what kind of meeting" and the line answers "where
 * exactly", but for every known location without a link the two collapse onto
 * the same words — a Phone meeting showed a "Phone" pill above a "Phone
 * meeting" line, and an office one said "HIBARR HQ" twice. The line is worth
 * rendering only when it carries something extra: a typed place name, or a
 * qualifier like "(link pending)".
 */
export function locationAddsDetail(item: {
    platformLabel: string;
    locationDisplay: string;
}): boolean {
    const normalise = (value: string) =>
        value
            .trim()
            .toLowerCase()
            // "Phone meeting" and "Phone" are the same answer.
            .replace(/\s+meeting$/, "");

    return normalise(item.locationDisplay) !== normalise(item.platformLabel);
}

export function toWorkspaceMeetingListItem(
    meeting: DealFollowup,
): WorkspaceMeetingListItem {
    const preview = toWorkspaceMeetingPreview(meeting);
    const platform = getPlatformMeta(meeting.location);
    const duration = meeting.duration ?? meeting.effective_duration ?? 30;
    const startsAt = preview.startsAt;
    const endDate = startsAt
        ? new Date(startsAt.getTime() + duration * 60 * 1000)
        : null;
    const endTimeLabel = formatUserTime(endDate);
    const timeRangeLabel = formatMeetingTimeRange(startsAt, endDate, "--", meeting.timezone);
    const meetingLink =
        meeting.meeting_link && /^https?:\/\//i.test(meeting.meeting_link)
            ? meeting.meeting_link
            : null;

    return {
        ...preview,
        title: meeting.meeting_type?.name?.trim() || preview.title,
        locationType: platform.locationType,
        endTimeLabel,
        timeRangeLabel,
        durationMinutes: duration,
        platformLabel: platform.label,
        platformBadgeVariant: platform.variant,
        locationDisplay: getLocationDisplay(meeting, platform.locationType),
        meetingLink,
        summaryStatus: getSummaryStatus(meeting),
        isConcluded:
            preview.isPast || (meeting.status?.trim() || "") === "completed",
        statusLabel: meeting.status?.trim() || "scheduled",
        typeColor: meeting.meeting_type?.color?.trim() || null,
        followup: meeting,
    };
}
