import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    isVideoPlatform,
    producesMeetingSummary,
} from "@/Components/Redesign/meeting/meetingFormUtils";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

/** The bucket a meeting falls in — mirrors the controller's SQL scopes. */
export type MeetingBucket = "upcoming" | "live" | "past";

/**
 * Filter tabs on the list.
 *
 * There is deliberately no "Live" tab: a live meeting is called out in the
 * list itself as a full-width card, so a tab that usually reads "0" would
 * only be a second, worse way to find something already impossible to miss.
 */
export type MeetingsTab = "all" | "upcoming" | "past";

/** Tab tallies the header renders next to each tab label. */
export type MeetingsTabCounts = Record<MeetingsTab, number>;

/**
 * How the meetings are laid out.
 *
 * The list is the page. There is no separate card view: cards turned out to
 * be the wrong shape for browsing a whole page of meetings — they say the
 * same things as a row while fitting a third as many on screen — but the
 * right shape for the two or three that are about to happen, which is where
 * they now live, above the list.
 */
export type MeetingsViewMode = "list" | "calendar";

const DEFAULT_DURATION = 30;

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

/**
 * The heading a day separator shows: "Today", "Tomorrow", "Yesterday", or the
 * date itself. Relative wording is what makes a list of dates scannable —
 * "Today" is read instantly, "Tue 01 Dec" has to be worked out.
 */
export function meetingDayLabel(dateUtc: string, timezone: string): string {
    const day = dayjs.utc(dateUtc).tz(timezone).startOf("day");
    const today = dayjs().tz(timezone).startOf("day");
    const diff = day.diff(today, "day");

    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";

    // The year only earns its space once the date isn't in this one.
    return day.year() === today.year()
        ? day.format("ddd DD MMM")
        : day.format("ddd DD MMM YYYY");
}

/** Day bucket key in the viewer's timezone, for grouping rows. */
export function meetingDayKey(dateUtc: string, timezone: string): string {
    return dayjs.utc(dateUtc).tz(timezone).format("YYYY-MM-DD");
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
 * Background for the small platform chip next to a meeting's title — each
 * provider's own brand color, so the chip reads at a glance the way the
 * provider's own product does. Falls back to a neutral gray for phone/on-site.
 */
export function platformChipColor(location: string): string {
    const colors: Record<string, string> = {
        zoom: "#2D8CFF",
        teams: "#5059C9",
        zoho: "#C8202A",
        zoho_meet: "#C8202A",
        meet: "#00897B",
        google_meet: "#00897B",
        skype: "#00AFF0",
    };
    return colors[location] ?? "#9CA3AF";
}

/**
 * "Starts in 2h" / "Starts in 45m" for a not-yet-started meeting's status
 * chip — the countdown a scheduled row is read for, once a bare "Scheduled"
 * label alone doesn't say how urgent it is.
 */
export function startsInLabel(
    dateUtc: string,
    timezone: string,
    now: dayjs.Dayjs = dayjs(),
): string {
    const start = dayjs.utc(dateUtc).tz(timezone);
    const minutes = start.diff(now, "minute");
    if (minutes <= 0) return "";
    if (minutes < 60) return `Starts in ${minutes}m`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Starts in ${hours}h`;
    const days = Math.round(hours / 24);
    return `Starts in ${days}d`;
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
 * Only the platforms `producesMeetingSummary` names can produce one.
 * Everything else shows neither the "View summary" link nor the "Generating…"
 * pill, because neither would ever resolve.
 */
export function meetingSummaryState(
    meeting: DealFollowup,
    bucket: MeetingBucket,
): MeetingSummaryState {
    if (!producesMeetingSummary(meeting.location, meeting.meeting_link)) {
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
    /** Which kind of record, so callers can label the link correctly. */
    type: "deal" | "lead";
}

/** The deal or lead a meeting hangs off, and where clicking it goes. */
export function meetingRecordLink(
    meeting: DealFollowup,
): MeetingRecordLink | null {
    if (meeting.deal) {
        return {
            name: meeting.deal.name,
            href: `/account/deals/${meeting.deal.id}`,
            type: "deal",
        };
    }
    if (meeting.lead) {
        return {
            name:
                meeting.lead.client_name_salutation ||
                meeting.lead.client_name ||
                "",
            href: route("lead-contact.show", meeting.lead.id),
            type: "lead",
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
