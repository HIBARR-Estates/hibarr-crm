import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
    formatUserDateTime,
    formatUserTime,
    getUserDateTimeTimezone,
} from "@/lib/userDateTime";
import { timezoneShortName } from "@/lib/timezoneLabel";

type Instant = Date | Dayjs | string | null | undefined;

function toDate(value: Instant): Date | null {
    if (value == null || value === "") return null;
    const d = dayjs.isDayjs(value) ? value.toDate() : new Date(value as string | Date);
    return Number.isNaN(d.getTime()) ? null : d;
}

function meetingAbbrev(value: Instant): string {
    const at = toDate(value) ?? new Date();
    return timezoneShortName(getUserDateTimeTimezone(), at);
}

function withAbbrev(label: string, value: Instant, fallback: string): string {
    if (!label || label === fallback) return label;
    const abbr = meetingAbbrev(value);
    return abbr ? `${label} ${abbr}` : label;
}

/** Viewer-local meeting time with short zone, e.g. "14:30 EAT". */
export function formatMeetingTime(value: Instant, fallback = "--"): string {
    return withAbbrev(formatUserTime(value, fallback), value, fallback);
}

/** Viewer-local meeting date+time with short zone on the time. */
export function formatMeetingDateTime(
    value: Instant,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    const fallback = options?.fallback ?? "--";
    return withAbbrev(formatUserDateTime(value, options), value, fallback);
}

/**
 * Start–end range with the zone once at the end, e.g. "14:00 – 14:30 EAT".
 */
export function formatMeetingTimeRange(
    start: Instant,
    end: Instant,
    fallback = "--",
): string {
    const startLabel = formatUserTime(start, fallback);
    const endLabel = formatUserTime(end, fallback);
    if (startLabel === fallback && endLabel === fallback) {
        return fallback;
    }
    const range =
        startLabel === fallback
            ? endLabel
            : endLabel === fallback
              ? startLabel
              : `${startLabel} – ${endLabel}`;
    const abbr = meetingAbbrev(start ?? end);
    return abbr ? `${range} ${abbr}` : range;
}
