/**
 * Single source of truth for date/time presentation in the Deal redesign.
 *
 * Locale: adapters are plain functions with no hook access, so the active
 * locale is published here once by the page shell (see `setDealDateLocale`)
 * and read synchronously. Falls back to "en" before the shell mounts.
 *
 * Time: uses company `time_format` (App Settings 12h/24h) via
 * `@/lib/taskDateTime`, synced by `CompanyDateTimeSync`.
 */

import { formatCompanyTime } from "@/lib/taskDateTime";

type Formatters = {
    date: Intl.DateTimeFormat;
    dateLong: Intl.DateTimeFormat;
    monthShort: Intl.DateTimeFormat;
};

/** App locale codes map to BCP-47 tags Intl understands. */
const LOCALE_MAP: Record<string, string> = {
    en: "en-GB",
    de: "de-DE",
    ru: "ru-RU",
    tr: "tr-TR",
};

let activeLocale = "en-GB";
let cache: Formatters | null = null;

/** Called once by the deal page shell with the Inertia `locale` prop. */
export function setDealDateLocale(locale: string | undefined | null): void {
    const next = LOCALE_MAP[locale ?? "en"] ?? LOCALE_MAP.en;
    if (next === activeLocale) return;
    activeLocale = next;
    cache = null;
}

function formatters(): Formatters {
    if (cache) return cache;
    cache = {
        // "8 Jul 2026" in en-GB, localised elsewhere.
        date: new Intl.DateTimeFormat(activeLocale, {
            day: "numeric",
            month: "short",
            year: "numeric",
        }),
        // "Wednesday, 8 July 2026"
        dateLong: new Intl.DateTimeFormat(activeLocale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
        }),
        monthShort: new Intl.DateTimeFormat(activeLocale, { month: "short" }),
    };
    return cache;
}

function toDate(value: Date | string | null | undefined): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    return date ? formatters().date.format(date) : fallback;
}

export function formatDateLong(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    return date ? formatters().dateLong.format(date) : fallback;
}

/** Company App Settings time format (12h / 24h). */
export function formatTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    return date ? formatCompanyTime(date, fallback) : fallback;
}

export function formatDateTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    if (!date) return fallback;
    return `${formatters().date.format(date)} · ${formatCompanyTime(date)}`;
}

export function formatMonthShort(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    return date ? formatters().monthShort.format(date) : fallback;
}

/** "8 Jul 2026 · 17:00" — locale date + company time format. */
export function formatDateWithTime(
    value: Date | string | null | undefined,
    fallback = "--",
): string {
    const date = toDate(value);
    if (!date) return fallback;
    return `${formatters().date.format(date)} · ${formatCompanyTime(date)}`;
}
