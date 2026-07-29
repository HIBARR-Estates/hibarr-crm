import type { DealFollowup } from "@/Types/api/deal-followup";
import { formatDateTime, formatMonthShort, formatTime } from "./dateFormat";

export interface WorkspaceMeetingPreview {
    id: number;
    title: string;
    status: string;
    startsAt: Date | null;
    startsAtLabel: string;
    timeLabel: string;
    monthLabel: string;
    dayLabel: string;
    isUpcoming: boolean;
    isPast: boolean;
    location: string;
    locationType: "video" | "in_person" | "phone";
    attendeesLabel: string;
}

function parseDate(value: string | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function resolveLocation(meeting: DealFollowup): {
    location: string;
    locationType: "video" | "in_person" | "phone";
} {
    const link = meeting.meeting_link?.trim();
    const location = meeting.location?.trim();
    if (link && /^https?:\/\//i.test(link)) {
        return { location: link, locationType: "video" };
    }
    if (location === "phone") {
        return { location: "Phone meeting", locationType: "phone" };
    }
    if (location) {
        return { location, locationType: "in_person" };
    }
    if (link) {
        return { location: link, locationType: "video" };
    }
    return { location: "No location set", locationType: "in_person" };
}

export function toWorkspaceMeetingPreview(meeting: DealFollowup): WorkspaceMeetingPreview {
    const startsAt = parseDate(meeting.next_follow_up_date);
    const normalizedStatus = meeting.status?.trim() || "scheduled";
    const meetingType = meeting.meeting_type?.name?.trim();
    const isUpcoming = startsAt ? startsAt.getTime() >= Date.now() : false;
    const { location, locationType } = resolveLocation(meeting);
    const attendees =
        meeting.participant_users?.map((user) => user.name).filter(Boolean) ?? [];

    return {
        id: meeting.id,
        title: meetingType || "Meeting",
        status: normalizedStatus,
        startsAt,
        startsAtLabel: formatDateTime(startsAt, "No date"),
        timeLabel: formatTime(startsAt, "No time"),
        monthLabel: formatMonthShort(startsAt),
        dayLabel: startsAt ? String(startsAt.getDate()) : "--",
        isUpcoming,
        isPast: startsAt ? startsAt.getTime() < Date.now() : false,
        location,
        locationType,
        attendeesLabel:
            // Empty when there are none; consumers already guard on falsy.
            attendees.length > 0 ? attendees.join(", ") : "",
    };
}
