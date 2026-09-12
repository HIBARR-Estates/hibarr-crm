import type { DealFollowup } from "@/Types/api/deal-followup";
import dayjs from "dayjs";
import {
    formatUserMonthShort,
    getUserDateTimeTimezone,
    isUserDateTimeEnabled,
} from "@/lib/userDateTime";
import { meetingBucket } from "@/Pages/Meetings/Redesign/adapters/meetingViewModel";
import {
    formatMeetingDateTime,
    formatMeetingTime,
} from "@/Pages/Meetings/Redesign/adapters/meetingTimeLabel";

export interface WorkspaceMeetingPreview {
    id: number;
    title: string;
    status: string;
    startsAt: Date | null;
    startsAtLabel: string;
    timeLabel: string;
    monthLabel: string;
    dayLabel: string;
    /** Start is still ahead of the clock. */
    isUpcoming: boolean;
    /** Start has passed and end has not — currently happening. */
    isLive: boolean;
    /** End has passed, or status is completed/cancelled. */
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
    // Same start/end clock as the Meetings page strip — not start-only.
    const bucket = startsAt
        ? meetingBucket(meeting, getUserDateTimeTimezone())
        : null;
    const { location, locationType } = resolveLocation(meeting);
    const attendees =
        meeting.participant_users?.map((user) => user.name).filter(Boolean) ?? [];

    return {
        id: meeting.id,
        title: meetingType || "Meeting",
        status: normalizedStatus,
        startsAt,
        startsAtLabel: formatMeetingDateTime(startsAt, {
            fallback: "No date",
            timezone: meeting.timezone,
        }),
        timeLabel: formatMeetingTime(startsAt, "No time", meeting.timezone),
        monthLabel: formatUserMonthShort(startsAt),
        dayLabel: viewerCalendarDay(startsAt),
        isUpcoming: bucket === "upcoming",
        isLive: bucket === "live",
        isPast: bucket === "past",
        location,
        locationType,
        attendeesLabel:
            // Empty when there are none; consumers already guard on falsy.
            attendees.length > 0 ? attendees.join(", ") : "",
    };
}
