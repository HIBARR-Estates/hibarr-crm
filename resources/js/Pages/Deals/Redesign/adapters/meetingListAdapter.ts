import type { DealFollowup } from "@/Types/api/deal-followup";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
    toWorkspaceMeetingPreview,
    type WorkspaceMeetingPreview,
} from "./meetingAdapter";

dayjs.extend(utc);

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

const TIME_FORMAT = new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
});

function getPlatformMeta(location?: string | null): {
    label: string;
    variant: "blue" | "green" | "gray";
    locationType: "video" | "in_person" | "phone";
} {
    switch (location) {
        case "zoho":
            return { label: "Video", variant: "blue", locationType: "video" };
        case "physical":
            return {
                label: "In person",
                variant: "green",
                locationType: "in_person",
            };
        case "phone":
            return { label: "Phone", variant: "gray", locationType: "phone" };
        case "office":
            return { label: "Office", variant: "gray", locationType: "in_person" };
        default:
            return { label: "Meeting", variant: "gray", locationType: "in_person" };
    }
}

function getSummaryStatus(meeting: DealFollowup): MeetingSummaryStatus {
    const nonVideoLocations = ["office", "phone", "physical"];
    if (nonVideoLocations.includes(meeting.location) || !meeting.meeting_link) {
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
            return "HIBARR Office";
        case "phone":
            return "Phone meeting";
        case "physical":
            return "In-person meeting";
        default:
            return meeting.location || "No location set";
    }
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
    const endTimeLabel = endDate ? TIME_FORMAT.format(endDate) : "--";
    const timeRangeLabel = `${preview.timeLabel} – ${endTimeLabel}`;
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
