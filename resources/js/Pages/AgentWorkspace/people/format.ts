import { dayKeyIn, taskTimeState, type TimeState } from "@/Components/Redesign/agent";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { dayDiff, taskDueText } from "../today/format";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Solid fills with white initials, picked by lead id so a person keeps their colour. */
const AVATAR_FILLS = [T.GREEN, T.GRAY_DARKER, T.BLUE_DARK, T.NAVY, T.BLUE, T.TEAL, T.GREEN_PRESSED];

export function avatarFill(id: number): string {
    return AVATAR_FILLS[Math.abs(id) % AVATAR_FILLS.length];
}

/** The date format the English UI reads best in: "Thu 12 Nov". */
function dateLocale(locale: string): string | undefined {
    return !locale || locale === "en" || locale === "eng" ? "en-GB" : locale;
}

/** "Thu 12 Nov" for a YYYY-MM-DD day key, with the year only when it is not this year. */
export function shortDate(day: string, locale: string, currentYear?: string): string {
    const withYear = currentYear !== undefined && day.slice(0, 4) !== currentYear;
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(locale), {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(withYear ? { year: "numeric" } : {}),
        timeZone: "UTC",
    });
}

export interface DueView {
    state: TimeState;
    text: string;
}

/**
 * The Due pill: late and today read like the task queue ("2 days late",
 * "Today 14:30"), a later day reads as a date, and no next action is a dash.
 * `dueAt` is the wall-clock string LeadService::attachNextActions renders in
 * the viewer's zone.
 */
export function nextActionDue(dueAt: string | null | undefined, nowMs: number, timeZone: string, locale: string, t: Translate): DueView {
    if (!dueAt) return { state: "none", text: t("pages.agent_workspace.people.row.no_value") };

    const state = taskTimeState({ due_date: dueAt, done: false }, nowMs, timeZone);
    if (state === "later") {
        const day = dueAt.slice(0, 10);
        const today = dayKeyIn(nowMs, timeZone);
        if (dayDiff(today, day) !== 1) return { state, text: shortDate(day, locale) };
    }
    return { state, text: taskDueText(dueAt, state, nowMs, timeZone, locale, t) };
}

/** "today", "yesterday", "5 days ago", "2 weeks ago", then a date; "never" when there is none. */
export function lastTouchText(iso: string | null | undefined, nowMs: number, timeZone: string, locale: string, t: Translate): string {
    if (!iso) return t("pages.agent_workspace.people.touch.never");
    const at = Date.parse(iso);
    if (Number.isNaN(at)) return t("pages.agent_workspace.people.touch.never");

    const today = dayKeyIn(nowMs, timeZone);
    const day = dayKeyIn(at, timeZone);
    const days = dayDiff(day, today);

    if (days <= 0) return t("pages.agent_workspace.people.touch.today");
    if (days === 1) return t("pages.agent_workspace.people.touch.yesterday");
    if (days < 14) return t("pages.agent_workspace.people.touch.days", { count: days });
    if (days < 28) return t("pages.agent_workspace.people.touch.weeks", { count: Math.floor(days / 7) });
    return shortDate(day, locale, today.slice(0, 4));
}

/** Filter keys that are not part of a "view": the chip, the search box, sorting and paging. */
const NON_VIEW_KEYS = new Set(["next_action", "search", "sort_by", "sort_direction", "page", "per_page"]);

function normalise(value: unknown): string {
    return Array.isArray(value) ? value.map(String).sort().join(",") : String(value ?? "");
}

/** The filters that make up a view, as comparable "key=value" strings. */
export function viewSignature(filters: Record<string, unknown> | null | undefined): string[] {
    return Object.entries(filters ?? {})
        .filter(([key, value]) => !NON_VIEW_KEYS.has(key) && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0))
        .map(([key, value]) => `${key}=${normalise(value).split(",").sort().join(",")}`)
        .sort();
}
