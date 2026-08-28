import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
    formatCompanyDate,
    formatCompanyDateTime,
    formatCompanyTime,
    omitYearFromDayjsFormat,
    type FormatCompanyDateOptions,
} from "@/lib/companyDateTime";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export const USER_TIMEZONE_FLAG = "crm.user-timezone";

let enabled = false;
let viewerTimezone = "UTC";
let contextVersion = 0;
const contextListeners = new Set<() => void>();

function notifyContextListeners(): void {
    contextVersion += 1;
    contextListeners.forEach((listener) => listener());
}

export function subscribeUserDateTimeContext(listener: () => void): () => void {
    contextListeners.add(listener);
    return () => contextListeners.delete(listener);
}

export function getUserDateTimeContextVersion(): number {
    return contextVersion;
}

export function getUserDateTimeTimezone(): string {
    return viewerTimezone;
}

export function isUserDateTimeEnabled(): boolean {
    return enabled;
}

export function setUserDateTimeContext(next: {
    enabled: boolean;
    timezone: string;
}): void {
    const tz =
        typeof next.timezone === "string" && next.timezone.trim() !== ""
            ? next.timezone.trim()
            : "UTC";
    if (next.enabled === enabled && tz === viewerTimezone) {
        return;
    }
    enabled = next.enabled;
    viewerTimezone = tz;
    notifyContextListeners();
}

function toZonedDayjs(
    value: Date | Dayjs | string | null | undefined,
): Dayjs | null {
    if (value == null || value === "") return null;
    const d = dayjs.isDayjs(value) ? value : dayjs(value);
    if (!d.isValid()) return null;
    try {
        const zoned = d.tz(viewerTimezone);
        return zoned.isValid() ? zoned : d;
    } catch {
        return d;
    }
}

function resolveZonedDateFormat(
    value: Dayjs,
    omitCurrentYear?: boolean,
): string {
    const format = companyDateDayjsFormat();
    if (
        omitCurrentYear &&
        value.isSame(dayjs().tz(viewerTimezone), "year")
    ) {
        return omitYearFromDayjsFormat(format);
    }
    return format;
}

export function formatUserDate(
    value: Date | Dayjs | string | null | undefined,
    fallbackOrOptions: string | FormatCompanyDateOptions = "--",
): string {
    if (!enabled) {
        return formatCompanyDate(value, fallbackOrOptions);
    }
    const options: FormatCompanyDateOptions =
        typeof fallbackOrOptions === "string"
            ? { fallback: fallbackOrOptions }
            : fallbackOrOptions;
    const d = toZonedDayjs(value);
    if (!d) return options.fallback ?? "--";
    return d.format(resolveZonedDateFormat(d, options.omitCurrentYear));
}

export function formatUserTime(
    value: Date | Dayjs | string | null | undefined,
    fallback = "--",
): string {
    if (!enabled) {
        return formatCompanyTime(value, fallback);
    }
    const d = toZonedDayjs(value);
    return d ? d.format(companyTimeDayjsFormat()) : fallback;
}

export function formatUserDateTime(
    value: Date | Dayjs | string | null | undefined,
    options?: {
        separator?: string;
        fallback?: string;
        omitCurrentYear?: boolean;
    },
): string {
    if (!enabled) {
        return formatCompanyDateTime(value, options);
    }
    const d = toZonedDayjs(value);
    if (!d) return options?.fallback ?? "--";
    const separator = options?.separator ?? " · ";
    return `${d.format(resolveZonedDateFormat(d, options?.omitCurrentYear))}${separator}${d.format(companyTimeDayjsFormat())}`;
}
