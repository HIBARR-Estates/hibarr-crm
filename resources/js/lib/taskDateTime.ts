import dayjs, { type Dayjs } from "dayjs";

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

const PHP_TO_DAYJS: Record<string, string> = {
    d: "DD",
    D: "ddd",
    j: "D",
    l: "dddd",
    N: "E",
    S: "Do",
    w: "d",
    z: "DDD",
    W: "W",
    F: "MMMM",
    m: "MM",
    M: "MMM",
    n: "M",
    Y: "YYYY",
    y: "YY",
    a: "a",
    A: "A",
    g: "h",
    G: "H",
    h: "hh",
    H: "HH",
    i: "mm",
    s: "ss",
};

/** PHP `company.time_format` — set once from Inertia shared props. */
let companyTimeFormatPhp = "H:i";

export function mapPhpToDayjsFormat(format: string): string {
    return format
        .split("")
        .map((char) => PHP_TO_DAYJS[char] || char)
        .join("");
}

/** Publish company time format from Inertia (`company.time_format`). */
export function setCompanyTimeFormat(
    phpFormat: string | undefined | null,
): void {
    const next = phpFormat?.trim() || "H:i";
    if (next === companyTimeFormatPhp) return;
    companyTimeFormatPhp = next;
}

/** Dayjs pattern for the company time format (e.g. `HH:mm` or `hh:mm A`). */
export function companyTimeDayjsFormat(): string {
    return mapPhpToDayjsFormat(companyTimeFormatPhp || "H:i");
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

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

function toDayjs(value: Date | Dayjs | string | null | undefined): Dayjs | null {
    if (!value) return null;
    if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : dayjs(value);
    }
    return taskDateTimeToDayjs(value);
}

/** Time only, using company `time_format`. */
export function formatCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    const d = toDayjs(value);
    return d ? d.format(companyTimeDayjsFormat()) : fallback;
}

/**
 * Date + company time, e.g. "8 Jul 2026 · 17:00" or "8 Jul 2026 · 5:00 PM".
 * `datePattern` is a dayjs date-only pattern (default matches Tasks UI).
 */
export function formatTaskDateWithCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    options?: { datePattern?: string; separator?: string; fallback?: string },
): string {
    const d = toDayjs(value);
    if (!d) return options?.fallback ?? "--";
    const datePattern = options?.datePattern ?? "MMM D, YYYY";
    const separator = options?.separator ?? " · ";
    return `${d.format(datePattern)}${separator}${d.format(companyTimeDayjsFormat())}`;
}

/** Compact date + time used on list rows: "MMM D, 5:00 PM". */
export function formatTaskDateTimeCompact(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    return formatTaskDateWithCompanyTime(value, {
        datePattern: "MMM D",
        separator: ", ",
        fallback,
    });
}

/** `YYYY-MM-DD` for `<input type="date">` from a task datetime string. */
export function toDateInputValue(value: string | null | undefined): string {
    const date = parseTaskDateTime(value);
    if (!date) return "";
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** `HH:mm` for `<input type="time">` from a task datetime string. */
export function toTimeInputValue(
    value: string | null | undefined,
    fallback = "17:00",
): string {
    const date = parseTaskDateTime(value);
    if (!date) return fallback;
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
