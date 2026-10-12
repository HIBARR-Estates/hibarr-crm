import dayjs, { type Dayjs } from "dayjs";
import utcPlugin from "dayjs/plugin/utc";
import {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
    formatCompanyDate,
    formatCompanyDateTime,
    formatCompanyTime,
    mapPhpToDayjsFormat,
    omitYearFromDayjsFormat,
    setCompanyDateTimeFormats,
    setCompanyTimeFormat,
} from "@/lib/companyDateTime";

dayjs.extend(utcPlugin);

export {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
    formatCompanyDate,
    formatCompanyDateTime,
    formatCompanyTime,
    mapPhpToDayjsFormat,
    setCompanyDateTimeFormats,
    setCompanyTimeFormat,
};

/**
 * Task start/due datetimes are wall-clock values (company date+time strings
 * parsed under app TZ, usually UTC). APIs may return them as:
 * - naive `Y-m-d H:i:s` (Tasks index), or
 * - ISO with `Z` (Eloquent `toJSON` / `toISOString`)
 *
 * Always treat the numeric clock face as the intended local display time —
 * never shift by the browser timezone offset.
 */
const WALL_CLOCK =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function pad4(n: number): string {
    return String(n).padStart(4, "0");
}


export interface TaskWallClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

/** The wall-clock components of a task datetime string, or null if it isn't one. */
export function parseTaskWallClock(
    value: string | null | undefined,
): TaskWallClock | null {
    if (!value) return null;
    const match = String(value).trim().match(WALL_CLOCK);
    if (!match) return null;

    const [, year, month, day, hour, minute, second] = match;

    return {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour ?? 0),
        minute: Number(minute ?? 0),
        second: Number(second ?? 0),
    };
}

/**
 * Holds wall-clock components verbatim for formatting.
 *
 * UTC mode is what makes this safe: the digits are never reinterpreted as
 * local time, so `.format()` emits exactly what was stored no matter which
 * zone the browser is in, DST gap or not.
 *
 * For *comparison* against a real "now", prefer parseTaskDateTime()/the local
 * Date instead — this object's epoch is UTC-based, so mixing it with a local
 * dayjs in an isBefore()/diff() skews the result by the viewer's UTC offset.
 */
function wallClockDayjs(wall: TaskWallClock): Dayjs {
    // Explicit Z: dayjs.utc() then treats these digits as already-UTC, so
    // .format() reproduces the stored clock face exactly. Without it the
    // value would be reinterpreted as local and shifted by the UTC offset.
    return dayjs.utc(
        `${pad4(wall.year)}-${pad2(wall.month)}-${pad2(wall.day)}` +
            `T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}Z`,
    );
}

/**
 * Parse a task datetime into a `Date` in the viewer's own timezone.
 *
 * Gap-safe for calendar-day arithmetic (a nonexistent local time still
 * normalises onto the correct day), but it cannot represent the clock face
 * itself — for anything that *displays* the time, pass the original string to
 * formatTaskCompanyTime / formatTaskDateWithCompanyTime, which format from the
 * stored digits instead.
 */
export function parseTaskDateTime(
    value: string | null | undefined,
): Date | null {
    if (!value) return null;
    const match = String(value).trim().match(WALL_CLOCK);
    if (!match) {
        const fallback = new Date(value);
        return Number.isNaN(fallback.getTime()) ? null : fallback;
    }
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
    );
    return Number.isNaN(date.getTime()) ? null : date;
}

export function taskDateTimeToDayjs(
    value: string | null | undefined,
): Dayjs | null {
    const date = parseTaskDateTime(value);
    return date ? dayjs(date) : null;
}

function toWallClockDayjs(
    value: Date | Dayjs | string | null | undefined,
): Dayjs | null {
    if (!value) return null;
    if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : dayjs(value);
    }
    return taskDateTimeToDayjs(value);
}

/**
 * Resolves the wall-clock dayjs and the resolved date format for a value.
 *
 * `wall` is non-null when the value was a wall-clock string, which both fixes
 * the digits (see parseTaskWallClock) and makes omitCurrentYear compare the
 * year on the face of the clock rather than this object's UTC epoch.
 */
function resolveTaskDateFormat(
    value: Date | Dayjs | string | null | undefined,
    omitCurrentYear?: boolean,
): { d: Dayjs; dateFormat: string } | null {
    const wall = typeof value === "string" ? parseTaskWallClock(value) : null;
    const d = wall ? wallClockDayjs(wall) : toWallClockDayjs(value);

    if (!d) return null;

    let dateFormat = companyDateDayjsFormat();
    const sameYear = wall
        ? wall.year === dayjs().year()
        : d.isSame(dayjs(), "year");

    if (omitCurrentYear && sameYear) {
        dateFormat = omitYearFromDayjsFormat(dateFormat);
    }

    return { d, dateFormat };
}

export function formatTaskCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    const wall = typeof value === "string" ? parseTaskWallClock(value) : null;
    if (wall) return wallClockDayjs(wall).format(companyTimeDayjsFormat());

    const d = toWallClockDayjs(value);
    return d ? d.format(companyTimeDayjsFormat()) : fallback;
}

/**
 * Date only, company `date_format`. For callers that append the time
 * themselves — formatTaskDateWithCompanyTime() always includes it, so using it
 * for a "date · time" label repeats the time twice.
 */
export function formatTaskCompanyDate(
    value: Date | Dayjs | string | null | undefined,
    options?: { fallback?: string; omitCurrentYear?: boolean },
): string {
    const resolved = resolveTaskDateFormat(value, options?.omitCurrentYear);

    return resolved
        ? resolved.d.format(resolved.dateFormat)
        : options?.fallback ?? "--";
}


export function formatTaskDateWithCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    const resolved = resolveTaskDateFormat(value, options?.omitCurrentYear);
    if (!resolved) return options?.fallback ?? "--";

    const separator = options?.separator ?? " · ";

    return `${resolved.d.format(resolved.dateFormat)}${separator}${resolved.d.format(companyTimeDayjsFormat())}`;
}

/** Compact task date+time for list rows. */
export function formatTaskDateTimeCompact(
    value: Date | Dayjs | string | null | undefined,
    fallbackOrOptions: string | {
        fallback?: string;
        omitCurrentYear?: boolean;
    } = "--",
): string {
    const options =
        typeof fallbackOrOptions === "string"
            ? { fallback: fallbackOrOptions }
            : fallbackOrOptions;
    return formatTaskDateWithCompanyTime(value, {
        separator: ", ",
        fallback: options.fallback ?? "--",
        omitCurrentYear: options.omitCurrentYear,
    });
}

/**
 * `YYYY-MM-DD` for `<input type="date">` from a task datetime string.
 *
 * Read from the wall-clock digits for the same reason as toTimeInputValue: a
 * Date built in the browser's zone can normalise the value forward.
 */
export function toDateInputValue(value: string | null | undefined): string {
    const wall = parseTaskWallClock(value);
    if (wall) {
        return `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
    }

    const date = parseTaskDateTime(value);
    if (!date) return "";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * `HH:mm` for `<input type="time">` from a task datetime string.
 *
 * Read straight off the string: parseTaskDateTime builds a `Date` in the
 * browser's own zone, which normalises a wall-clock time that does not exist
 * locally (a DST spring-forward hour) to the next valid one — the form would
 * then show, and save, an hour the task was never due at.
 */
export function toTimeInputValue(
    value: string | null | undefined,
    fallback = "17:00",
): string {
    const wall = parseTaskWallClock(value);
    if (wall) return `${pad2(wall.hour)}:${pad2(wall.minute)}`;

    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? fallback
        : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
