import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
    omitYearFromDayjsFormat,
} from "@/lib/companyDateTime";
import {
    formatUserDateTime,
    formatUserTime,
    getUserDateTimeTimezone,
} from "@/lib/userDateTime";
import { timezoneShortName } from "@/lib/timezoneLabel";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

type Instant = Date | Dayjs | string | null | undefined;

/**
 * Prefer the meeting's booked IANA zone; fall back to the viewer's display zone.
 */
export function resolveMeetingDisplayTimezone(
    meetingTimezone?: string | null,
): string {
    const trimmed =
        typeof meetingTimezone === "string" ? meetingTimezone.trim() : "";
    return trimmed !== "" ? trimmed : getUserDateTimeTimezone();
}

function hasMeetingTimezone(meetingTimezone?: string | null): boolean {
    return typeof meetingTimezone === "string" && meetingTimezone.trim() !== "";
}

function toDate(value: Instant): Date | null {
    if (value == null || value === "") return null;
    const d = dayjs.isDayjs(value)
        ? value.toDate()
        : new Date(value as string | Date);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toZoned(value: Instant, timezone: string): Dayjs | null {
    const at = toDate(value);
    if (!at) return null;
    try {
        const zoned = dayjs(at).tz(timezone);
        return zoned.isValid() ? zoned : null;
    } catch {
        return null;
    }
}

function formatTimeInZone(
    value: Instant,
    meetingTimezone: string | null | undefined,
    fallback: string,
): string {
    // No booked zone → keep the existing viewer/company formatters.
    if (!hasMeetingTimezone(meetingTimezone)) {
        return formatUserTime(value, fallback);
    }
    const zoned = toZoned(value, meetingTimezone!.trim());
    return zoned ? zoned.format(companyTimeDayjsFormat()) : fallback;
}

function formatDateTimeInZone(
    value: Instant,
    meetingTimezone: string | null | undefined,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    if (!hasMeetingTimezone(meetingTimezone)) {
        return formatUserDateTime(value, options);
    }
    const fallback = options?.fallback ?? "--";
    const zone = meetingTimezone!.trim();
    const zoned = toZoned(value, zone);
    if (!zoned) return fallback;
    let dateFormat = companyDateDayjsFormat();
    if (options?.omitCurrentYear && zoned.isSame(dayjs().tz(zone), "year")) {
        dateFormat = omitYearFromDayjsFormat(dateFormat);
    }
    const separator = options?.separator ?? " · ";
    return `${zoned.format(dateFormat)}${separator}${zoned.format(companyTimeDayjsFormat())}`;
}

function withAbbrev(
    label: string,
    value: Instant,
    fallback: string,
    meetingTimezone?: string | null,
): string {
    if (!label || label === fallback) return label;
    const at = toDate(value) ?? new Date();
    const abbr = timezoneShortName(
        resolveMeetingDisplayTimezone(meetingTimezone),
        at,
    );
    return abbr ? `${label} ${abbr}` : label;
}

/** Meeting wall-clock time with short zone, e.g. "14:30 EAT". */
export function formatMeetingTime(
    value: Instant,
    fallback = "--",
    meetingTimezone?: string | null,
): string {
    return withAbbrev(
        formatTimeInZone(value, meetingTimezone, fallback),
        value,
        fallback,
        meetingTimezone,
    );
}

/** Meeting date+time with short zone on the time. */
export function formatMeetingDateTime(
    value: Instant,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
        timezone?: string | null;
    },
): string {
    const fallback = options?.fallback ?? "--";
    const meetingTimezone = options?.timezone;
    return withAbbrev(
        formatDateTimeInZone(value, meetingTimezone, options),
        value,
        fallback,
        meetingTimezone,
    );
}

/**
 * Start–end range with the zone once at the end, e.g. "14:00 – 14:30 EAT".
 */
export function formatMeetingTimeRange(
    start: Instant,
    end: Instant,
    fallback = "--",
    meetingTimezone?: string | null,
): string {
    const startLabel = formatTimeInZone(start, meetingTimezone, fallback);
    const endLabel = formatTimeInZone(end, meetingTimezone, fallback);
    if (startLabel === fallback && endLabel === fallback) {
        return fallback;
    }
    const range =
        startLabel === fallback
            ? endLabel
            : endLabel === fallback
              ? startLabel
              : `${startLabel} – ${endLabel}`;
    return withAbbrev(range, start ?? end, fallback, meetingTimezone);
}
