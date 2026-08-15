import dayjs, { type Dayjs } from "dayjs";

/**
 * Company App Settings date/time display helpers.
 *
 * Prefer `moment_date_format` (already Moment/Dayjs tokens from the backend)
 * when available; fall back to mapping PHP `date_format`.
 * `time_format` stays PHP (`H:i` / `h:i A`) and is mapped to Dayjs.
 *
 * Formats are published by CompanyDateTimeSync. A version counter lets React
 * re-render when settings change mid-session.
 */

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

let companyDateDayjs = "DD-MM-YYYY";
let companyTimeFormatPhp = "H:i";
let formatVersion = 0;
const formatListeners = new Set<() => void>();

export function mapPhpToDayjsFormat(format: string): string {
    return format
        .split("")
        .map((char) => PHP_TO_DAYJS[char] || char)
        .join("");
}

function notifyFormatListeners(): void {
    formatVersion += 1;
    formatListeners.forEach((listener) => listener());
}

/** Subscribe to format changes (used by CompanyDateTimeProvider). */
export function subscribeCompanyDateTimeFormats(
    listener: () => void,
): () => void {
    formatListeners.add(listener);
    return () => formatListeners.delete(listener);
}

export function getCompanyDateTimeFormatVersion(): number {
    return formatVersion;
}

export function setCompanyDateTimeFormats(formats: {
    date_format?: string | null;
    /** Pre-mapped Moment/Dayjs pattern from company.moment_date_format / moment_format */
    moment_date_format?: string | null;
    time_format?: string | null;
}): void {
    let changed = false;

    const momentFmt = formats.moment_date_format?.trim();
    if (momentFmt) {
        if (momentFmt !== companyDateDayjs) {
            companyDateDayjs = momentFmt;
            changed = true;
        }
    } else if (
        formats.date_format != null &&
        formats.date_format.trim() !== ""
    ) {
        const mapped = mapPhpToDayjsFormat(formats.date_format.trim());
        if (mapped !== companyDateDayjs) {
            companyDateDayjs = mapped;
            changed = true;
        }
    }

    if (formats.time_format != null && formats.time_format.trim() !== "") {
        const next = formats.time_format.trim();
        if (next !== companyTimeFormatPhp) {
            companyTimeFormatPhp = next;
            changed = true;
        }
    }

    if (changed) {
        notifyFormatListeners();
    }
}

/** @deprecated Prefer setCompanyDateTimeFormats */
export function setCompanyTimeFormat(
    phpFormat: string | undefined | null,
): void {
    setCompanyDateTimeFormats({ time_format: phpFormat });
}

export function companyDateDayjsFormat(): string {
    return companyDateDayjs || "DD-MM-YYYY";
}

export function companyTimeDayjsFormat(): string {
    return mapPhpToDayjsFormat(companyTimeFormatPhp || "H:i");
}

export function companyDateTimeDayjsFormat(separator = " "): string {
    return `${companyDateDayjsFormat()}${separator}${companyTimeDayjsFormat()}`;
}

/**
 * Parse a datetime string that is really a naive wall-clock value (e.g.
 * flight_date: the airport's own local time, with no real UTC meaning)
 * even though Eloquent's default JSON cast tags it with a "Z" as if it
 * were an absolute instant. Strips any timezone marker before parsing so
 * `new Date()` keeps the literal numbers instead of reinterpreting them
 * through the viewer's browser timezone.
 */
export function parseNaiveDateTime(
    value: string | Date | null | undefined,
): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const naive = value
        .trim()
        .replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, "")
        .replace(" ", "T");
    const parsed = new Date(naive);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDayjs(value: Date | Dayjs | string | null | undefined): Dayjs | null {
    if (value == null || value === "") return null;
    if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
}

/** Strip year tokens from a Dayjs date format (e.g. `DD-MM-YYYY` → `DD-MM`). */
export function omitYearFromDayjsFormat(format: string): string {
    const stripped = format
        .replace(/Y{2,4}/g, "")
        .replace(/([/.\-\s,])\1+/g, "$1")
        .replace(/^[/.\-\s,]+|[/.\-\s,]+$/g, "")
        .trim();
    return stripped || format;
}

export type FormatCompanyDateOptions = {
    fallback?: string;
    /**
     * When true, drop the year from the company date format if the value
     * falls in the current calendar year.
     */
    omitCurrentYear?: boolean;
};

function resolveDateFormat(
    value: Dayjs,
    omitCurrentYear?: boolean,
): string {
    const format = companyDateDayjsFormat();
    if (omitCurrentYear && value.isSame(dayjs(), "year")) {
        return omitYearFromDayjsFormat(format);
    }
    return format;
}

/** Date only — company date format. */
export function formatCompanyDate(
    value: Date | Dayjs | string | null | undefined,
    fallbackOrOptions: string | FormatCompanyDateOptions = "--",
): string {
    const options: FormatCompanyDateOptions =
        typeof fallbackOrOptions === "string"
            ? { fallback: fallbackOrOptions }
            : fallbackOrOptions;
    const d = toDayjs(value);
    if (!d) return options.fallback ?? "--";
    return d.format(resolveDateFormat(d, options.omitCurrentYear));
}

/** Time only — company `time_format`. */
export function formatCompanyTime(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    const d = toDayjs(value);
    return d ? d.format(companyTimeDayjsFormat()) : fallback;
}

/** Date + time — company formats, joined with `separator` (default " · "). */
export function formatCompanyDateTime(
    value: Date | Dayjs | string | null | undefined,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    const d = toDayjs(value);
    if (!d) return options?.fallback ?? "--";
    const separator = options?.separator ?? " · ";
    return `${d.format(resolveDateFormat(d, options?.omitCurrentYear))}${separator}${d.format(companyTimeDayjsFormat())}`;
}
