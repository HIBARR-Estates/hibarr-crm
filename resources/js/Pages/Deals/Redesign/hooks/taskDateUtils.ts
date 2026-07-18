import dayjs from "dayjs";

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

export function mapPhpToDayjsFormat(format: string): string {
    return format
        .split("")
        .map((char) => PHP_TO_DAYJS[char] || char)
        .join("");
}

/** Default due time for new/undated tasks — end of business day. */
export const DEFAULT_DUE_TIME = "17:00";

/** Default start time when only a start date is collected (no time picker). */
export const DEFAULT_START_TIME = "09:00";

/** Combines a `YYYY-MM-DD` date and `HH:mm` time into the company's API format. */
export function formatDueDateTimeForApi(
    isoDate: string,
    time: string | undefined,
    dateFormat: string,
): string {
    const safeTime = time?.trim() || DEFAULT_DUE_TIME;
    return dayjs(`${isoDate}T${safeTime}`).format(mapPhpToDayjsFormat(dateFormat));
}

/** Local `HH:mm` for a `<input type="time">`, extracted from an ISO due-date string. */
export function extractLocalTime(isoDateTime: string | undefined): string {
    if (!isoDateTime) return DEFAULT_DUE_TIME;
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) return DEFAULT_DUE_TIME;
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` for today, matching how `<input type="date">` values and
 * `task.due_date`/`task.start_date`'s leading 10 chars are compared elsewhere
 * in this file — kept consistent rather than local-timezone-converted. */
export function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}
