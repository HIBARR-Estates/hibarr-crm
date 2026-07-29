import dayjs from "dayjs";
import {
    formatCompanyTime,
    mapPhpToDayjsFormat,
    toTimeInputValue,
} from "@/lib/taskDateTime";

export { mapPhpToDayjsFormat } from "@/lib/taskDateTime";

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

/** `HH:mm` for a `<input type="time">` from a task due/start datetime string. */
export function extractLocalTime(isoDateTime: string | undefined): string {
    return toTimeInputValue(isoDateTime, DEFAULT_DUE_TIME);
}

/** `YYYY-MM-DD` for today — UTC calendar day for input defaults. */
export function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Re-export for call sites that already import from this module. */
export { formatCompanyTime };
