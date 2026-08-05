/**
 * Redesign date/time presentation — thin wrappers over company App
 * Settings formats (`date_format` / `time_format`), synced by
 * `CompanyDateTimeSync`.
 */

import dayjs from "dayjs";
import {
    formatCompanyDate,
    formatCompanyDateTime,
    formatCompanyTime,
    mapPhpToDayjsFormat,
} from "@/lib/companyDateTime";

/** @deprecated Locale no longer affects redesign date formatting. */
export function setRedesignDateLocale(_locale: string | undefined | null): void {
    // no-op — company date_format / time_format are used instead
}

/** @deprecated Prefer setRedesignDateLocale. */
export const setDealDateLocale = setRedesignDateLocale;

export function formatDate(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    return formatCompanyDate(value, fallback);
}

export function formatDateLong(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    return formatCompanyDate(value, fallback);
}

export function formatTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    return formatCompanyTime(value, fallback);
}

export function formatDateTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    return formatCompanyDateTime(value, { fallback });
}

export function formatMonthShort(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    if (!value) return fallback;
    const d = dayjs(value);
    return d.isValid() ? d.format(mapPhpToDayjsFormat("M")) : fallback;
}

export function formatDateWithTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    return formatCompanyDateTime(value, { fallback });
}
