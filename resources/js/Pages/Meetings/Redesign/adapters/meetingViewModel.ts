import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { isVideoPlatform } from "@/Components/Redesign/meeting/meetingFormUtils";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

/** The bucket a meeting falls in — mirrors the controller's SQL scopes. */
export type MeetingBucket = "upcoming" | "live" | "past";

/** Filter tabs on the cards view. `all` is every bucket. */
export type MeetingsTab = "all" | MeetingBucket;

export type MeetingsViewMode = "cards" | "calendar";

const DEFAULT_DURATION = 30;

/** Locations that are neither video nor phone — no link, no summary. */
const ON_SITE_LOCATIONS = ["office", "physical"];

export function isOnSiteLocation(location: string): boolean {
    return ON_SITE_LOCATIONS.includes(location) || !isKnownLocation(location);
}

function isKnownLocation(location: string): boolean {
    return (
        isVideoPlatform(location) ||
        location === "phone" ||
        ON_SITE_LOCATIONS.includes(location)
    );
}

/**
 * Zoned start/end for a meeting. `next_follow_up_date` is a UTC instant; every
 * date the page shows has to be read in the viewer's timezone or a late-evening
 * meeting lands on the wrong calendar day.
 */
export function meetingRange(
    meeting: Pick<DealFollowup, "next_follow_up_date"> & {
        duration?: number | null;
        effective_duration?: number;
    },
    timezone: string,
) {
    const minutes =
        meeting.duration ?? meeting.effective_duration ?? DEFAULT_DURATION;
    const start = dayjs.utc(meeting.next_follow_up_date).tz(timezone);
    return { start, end: start.add(minutes, "minute"), minutes };
}

export function meetingBucket(
    meeting: Pick<DealFollowup, "next_follow_up_date" | "status"> & {
        duration?: number | null;
        effective_duration?: number;
    },
    timezone: string,
    now: dayjs.Dayjs = dayjs(),
): MeetingBucket {
    const { start, end } = meetingRange(meeting, timezone);
    if (
        meeting.status === "scheduled" &&
        !start.isAfter(now) &&
        !end.isBefore(now)
    ) {
        return "live";
    }
    return start.isBefore(now) ? "past" : "upcoming";
}

/** "AUG / 14 / Thu" for the date tile, in the viewer's timezone. */
export function meetingDateParts(dateUtc: string, timezone: string) {
    const zoned = dayjs.utc(dateUtc).tz(timezone);
    return {
        month: zoned.format("MMM"),
        day: zoned.format("DD"),
        weekday: zoned.format("ddd"),
    };
}

/** The Icon primitive glyph that stands for a meeting's location. */
export function platformIconName(location: string): string {
    if (isVideoPlatform(location)) return "video";
    if (location === "phone") return "phone";
    return "map-pin";
}

/**
 * `pages.meetings.platforms.*` key for a stored location, or null for a
 * free-text place name (which is already human-readable — show it as is).
 */
export function platformLabelKey(location: string): string | null {
    const keys: Record<string, string> = {
        zoho: "video_meeting",
        zoho_meet: "video_meeting",
        zoom: "zoom",
        teams: "teams",
        meet: "google_meet",
        google_meet: "google_meet",
        phone: "phone",
        office: "office",
        physical: "physical",
        skype: "skype",
        other: "other",
    };
    const key = keys[location];
    return key ? `pages.meetings.platforms.${key}` : null;
}

export type MeetingSummaryState = "ready" | "generating" | "none";

/**
 * Summaries are only produced for video meetings that carry a link — an
 * on-site or phone meeting has nothing to transcribe, so it shows neither
 * the "View summary" link nor the "Generating…" pill.
 */
export function meetingSummaryState(
    meeting: DealFollowup,
    bucket: MeetingBucket,
): MeetingSummaryState {
    if (isOnSiteLocation(meeting.location) || !meeting.meeting_link) {
        return "none";
    }
    if (meeting.meeting_summary) return "ready";
    return bucket === "past" ? "generating" : "none";
}

export function isSafeMeetingUrl(url?: string | null): boolean {
    return !!url && /^https?:\/\//i.test(url);
}

/** Join is offered while a video meeting is still ahead of (or in) its slot. */
export function canJoinMeeting(
    meeting: DealFollowup,
    bucket: MeetingBucket,
): boolean {
    return (
        bucket !== "past" &&
        isVideoPlatform(meeting.location) &&
        isSafeMeetingUrl(meeting.meeting_link)
    );
}

export interface MeetingRecordLink {
    name: string;
    href: string | null;
}

/** The deal or lead a meeting hangs off, and where clicking it goes. */
export function meetingRecordLink(
    meeting: DealFollowup,
): MeetingRecordLink | null {
    if (meeting.deal) {
        return {
            name: meeting.deal.name,
            href: `/account/deals/${meeting.deal.id}`,
        };
    }
    if (meeting.lead) {
        return {
            name:
                meeting.lead.client_name_salutation ||
                meeting.lead.client_name ||
                "",
            href: route("lead-contact.show", meeting.lead.id),
        };
    }
    return null;
}

type PermissionScope = "all" | "added" | "none" | string;

/** `all` grants everyone; `added` only the creator. */
export function hasMeetingPermission(
    scope: PermissionScope | undefined,
    meeting: DealFollowup,
    userId?: number,
): boolean {
    if (scope === "all") return true;
    return scope === "added" && meeting.added_by?.id === userId;
}
