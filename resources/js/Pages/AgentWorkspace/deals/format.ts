import { dayKeyIn } from "@/Components/Redesign/agent";
import { dayDiff, instantTime } from "../today/format";
import { shortDate } from "../people/format";
import type { DealExtras, DealItem, DealView } from "./types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** A deal counts as idle from this many days without activity (the chip's own label: "Idle 7+ days"). */
export const IDLE_DAYS = 7;

/** "€ 6,500". */
export function formatMoney(value: number, symbol: string, locale: string): string {
    return `${symbol} ${Math.round(value).toLocaleString(numberLocale(locale))}`;
}

/** "€ 9.2k" for the column headers and the pipeline total; below a thousand the plain figure. */
export function formatCompact(value: number, symbol: string, locale: string): string {
    if (Math.abs(value) < 1000) return formatMoney(value, symbol, locale);
    const thousands = Math.round(value / 100) / 10;
    return `${symbol} ${thousands.toLocaleString(numberLocale(locale), { maximumFractionDigits: 1 })}k`;
}

function numberLocale(locale: string): string | undefined {
    return !locale || locale === "en" || locale === "eng" ? "en-US" : locale;
}

/** "Michael Braun" → "Braun"; the line under the name is "surname · deal". */
export function dealLine(person: string | null, name: string | null): string {
    const deal = (name ?? "").trim();
    const surname = (person ?? "").trim().split(/\s+/).pop() ?? "";
    if (!surname) return deal;
    if (!deal) return surname;
    return deal.toLowerCase().includes(surname.toLowerCase()) ? deal : `${surname} · ${deal}`;
}

export interface MeetingView {
    text: string;
    /** today reads amber ("soon"), any later day blue. */
    state: "soon" | "later";
}

/**
 * "today 15:00", "Tue 14:00" within the next six days, then "Mon 16 Nov".
 * Meetings still to come only: the server leaves out any that have passed.
 */
export function meetingView(iso: string | null, nowMs: number, timeZone: string, locale: string, t: Translate): MeetingView | null {
    if (!iso) return null;
    const at = Date.parse(iso);
    if (Number.isNaN(at)) return null;

    const today = dayKeyIn(nowMs, timeZone);
    const day = dayKeyIn(at, timeZone);
    const ahead = dayDiff(today, day);

    if (ahead <= 0) return { state: "soon", text: t("pages.agent_workspace.deals.meeting.today", { time: instantTime(iso, timeZone) }) };
    if (ahead <= 6) {
        const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString(locale === "eng" || locale === "en" ? "en-GB" : locale, { weekday: "short", timeZone: "UTC" });
        return { state: "later", text: `${weekday} ${instantTime(iso, timeZone)}` };
    }
    return { state: "later", text: shortDate(day, locale) };
}

/** Whole days since a deal's last activity (its creation if nothing was logged), or null before the extras arrive. */
export function idleDaysOf(deal: DealItem, extras: DealExtras | undefined, nowMs: number, timeZone: string): number | null {
    if (!extras) return null;
    const since = extras.last_activity_at ?? deal.created_at;
    if (!since) return null;
    const at = Date.parse(since);
    if (Number.isNaN(at)) return null;
    return Math.max(0, dayDiff(dayKeyIn(at, timeZone), dayKeyIn(nowMs, timeZone)));
}

/** Everything a card and a row show for a deal, worked out once per render of the page. */
export function dealViews(deals: DealItem[], extras: Record<number, DealExtras> | undefined, nowMs: number, timeZone: string): DealView[] {
    const today = dayKeyIn(nowMs, timeZone);
    return deals.map((deal) => {
        const own = extras?.[deal.id];
        const meetingDay = deal.next_meeting_at ? dayKeyIn(Date.parse(deal.next_meeting_at), timeZone) : null;
        const ahead = meetingDay ? dayDiff(today, meetingDay) : null;
        return {
            deal,
            extras: own,
            idleDays: idleDaysOf(deal, own, nowMs, timeZone),
            meetingWithinWeek: ahead !== null && ahead <= 7,
            ready: own !== undefined && own.conditions.total > 0 && own.conditions.met >= own.conditions.total,
        };
    });
}

/** The Last activity column: a relative day, red once the deal is idle. */
export function activityText(view: DealView, nowMs: number, timeZone: string, locale: string, t: Translate): { text: string; idle: boolean } {
    if (view.idleDays !== null && view.idleDays >= IDLE_DAYS) {
        return { text: t("pages.agent_workspace.deals.idle", { count: view.idleDays }), idle: true };
    }
    const since = view.extras?.last_activity_at ?? view.deal.created_at;
    if (!since) return { text: t("pages.agent_workspace.deals.activity.none"), idle: false };

    const today = dayKeyIn(nowMs, timeZone);
    const day = dayKeyIn(Date.parse(since), timeZone);
    const days = dayDiff(day, today);
    if (days <= 0) return { text: t("pages.agent_workspace.deals.activity.today"), idle: false };
    if (days === 1) return { text: t("pages.agent_workspace.deals.activity.yesterday"), idle: false };
    return { text: t("pages.agent_workspace.deals.activity.days", { count: days }), idle: false };
}
