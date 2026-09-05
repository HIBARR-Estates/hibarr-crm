import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    toWorkspaceMeetingPreview,
    type WorkspaceMeetingPreview,
} from "./meetingAdapter";
import { formatUserTime } from "@/lib/userDateTime";

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
