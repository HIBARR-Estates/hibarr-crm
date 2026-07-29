import dayjs, { type Dayjs } from "dayjs";
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

/** Time only for task wall-clock values — company `time_format`. */
export function formatTaskCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    const d = toWallClockDayjs(value);
    return d ? d.format(companyTimeDayjsFormat()) : fallback;
}

/**
 * Task wall-clock date + company time using company `date_format` + `time_format`.
 */
export function formatTaskDateWithCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    const d = toWallClockDayjs(value);
    if (!d) return options?.fallback ?? "--";
    const separator = options?.separator ?? " · ";
    let dateFormat = companyDateDayjsFormat();
    if (options?.omitCurrentYear && d.isSame(dayjs(), "year")) {
        dateFormat = omitYearFromDayjsFormat(dateFormat);
    }
    return `${d.format(dateFormat)}${separator}${d.format(companyTimeDayjsFormat())}`;
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
