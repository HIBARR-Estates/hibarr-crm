import type { DealFollowup } from "@/Types/api/deal-followup";
import dayjs from "dayjs";
import {
    formatUserDateTime,
    formatUserMonthShort,
    formatUserTime,
    getUserDateTimeTimezone,
    isUserDateTimeEnabled,
} from "@/lib/userDateTime";

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

function viewerCalendarDay(startsAt: Date | null): string {
    if (!startsAt) return "--";
    if (isUserDateTimeEnabled()) {
        try {
            const zoned = dayjs(startsAt).tz(getUserDateTimeTimezone());
            return zoned.isValid() ? String(zoned.date()) : "--";
        } catch {
            return String(startsAt.getDate());
        }
    }
    return String(startsAt.getDate());
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
        startsAtLabel: formatUserDateTime(startsAt, { fallback: "No date" }),
        timeLabel: formatUserTime(startsAt, "No time"),
        monthLabel: formatUserMonthShort(startsAt),
        dayLabel: viewerCalendarDay(startsAt),
        isUpcoming,
        isPast: startsAt ? startsAt.getTime() < Date.now() : false,
        location,
        locationType,
        attendeesLabel:
            // Empty when there are none; consumers already guard on falsy.
            attendees.length > 0 ? attendees.join(", ") : "",
    };
}
