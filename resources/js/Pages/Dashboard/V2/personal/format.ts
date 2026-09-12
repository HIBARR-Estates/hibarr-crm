/**
 * Display helpers for the personal dashboard.
 *
 * Pure functions with no hook access, so they can run outside the render path
 * and inside `useMemo` — same split as Deals/Redesign/adapters.
 *
 * Helpers that cross into the role-scoped views (money, greetingFor) live one
 * level up in ../format — this file is only what these panels need.
 */

import dayjs from "dayjs";
import { money } from "../format";
import type { QueueTask } from "../types";
import type { CurrencyTotal, Severity } from "./types";

/**
 * Folds same-currency rows together, ordered alphabetically by currency.
 *
 * Each pipeline's own `totals` already comes pre-merged from the server —
 * one row per currency for that pipeline. But flattening several pipelines
 * together (the header status line, the Deals stat tile) can put the same
 * currency in the list twice, from two different pipelines, and without
 * this a naive "take the first entry" reads whichever pipeline happens to
 * sort first rather than the true total in that currency.
 *
 * Deliberately not ranked by amount: totals in different currencies aren't
 * comparable without an exchange rate, and the stored rates aren't
 * maintained, so sorting by raw total would rank a currency as "dominant"
 * purely because its unit happens to produce a bigger number.
 */
export function mergeCurrencyTotals(totals: CurrencyTotal[]): CurrencyTotal[] {
    const merged = new Map<string, number>();

    for (const { currency, total } of totals) {
        merged.set(currency, (merged.get(currency) ?? 0) + total);
    }

    return [...merged.entries()]
        .map(([currency, total]) => ({ currency, total }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * The dominant currency of a split total, plus what it leaves out.
 *
 * Never sums across currencies: the stored exchange rates are unmaintained,
 * so one rolled-up figure would look authoritative and be wrong. The caller
 * shows `rest` as a footnote instead. Pass the totals through
 * mergeCurrencyTotals() first if they might contain the same currency twice
 * (e.g. flattened across pipelines) — this only picks the first entry, it
 * doesn't combine duplicates itself.
 */
export function dominantTotal(totals: CurrencyTotal[]): {
    label: string;
    rest: string | null;
} {
    if (!totals.length) {
        return { label: "—", rest: null };
    }

    const [first, ...others] = totals;

    return {
        label: money(first.total, first.currency),
        rest: others.length
            ? `+ ${others.map((t) => money(t.total, t.currency)).join(" · ")}`
            : null,
    };
}

/** Which due window a task falls in. Drives the rail, glyph and section. */
export function severityOf(task: QueueTask): Severity {
    if (task.days_overdue > 0) return "now";

    return dayjs(task.due_date).isSame(dayjs(), "day") ? "soon" : "watch";
}

/**
 * The pill on a queue row: how late, or how soon.
 *
 * English source strings — the caller wraps them in td() at the render site,
 * per the two-tier translation rule.
 */
export function dueLabel(task: QueueTask): string {
    if (task.days_overdue === 1) return "1 day overdue";
    if (task.days_overdue > 1) return `${task.days_overdue} days overdue`;

    const due = dayjs(task.due_date);

    if (due.isSame(dayjs(), "day")) {
        return due.hour() || due.minute()
            ? `Due ${due.format("HH:mm")}`
            : "Due today";
    }

    return `Due ${due.format("dddd")}`;
}

/**
 * The elapsed clause of the metadata line: "due 26 Aug", "due today",
 * "in 3 days". The record half is rendered separately, because it is a link.
 */
export function dueWhen(task: QueueTask): string {
    const due = dayjs(task.due_date);

    if (task.days_overdue > 0) return `due ${due.format("D MMM")}`;
    if (due.isSame(dayjs(), "day")) return "due today";

    const days = due.startOf("day").diff(dayjs().startOf("day"), "day");

    return days === 1 ? "tomorrow" : `in ${days} days`;
}

/**
 * A task's own description, as the row's reason sentence.
 *
 * Descriptions are stored as HTML from the rich-text editor, so tags are
 * stripped rather than rendered — a queue row is one line of plain prose, and
 * dangerouslySetInnerHTML on user input here buys nothing.
 */
export function reasonOf(task: QueueTask): string {
    const raw = task.description;

    if (!raw) return "";

    const text = raw
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();

    return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

/**
 * A meeting length as a human reads it: "30 min", "1 hr", "1.5 hr", "2 hr".
 *
 * Anything from 59 minutes up is expressed in hours — "59 min" and "60 min"
 * are the same appointment to whoever booked it, and only one of them reads
 * like a real answer. Returns null when the duration is missing or zero, so
 * the caller renders nothing rather than "0 min".
 */
export function durationLabel(minutes: number | null | undefined): string | null {
    if (!minutes || minutes <= 0) return null;

    if (minutes < 59) return `${Math.round(minutes)} min`;

    const hours = minutes / 60;

    // One decimal only when it earns one: 1.5 hr, but 1 hr and 2 hr.
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}

/**
 * The day an agenda entry falls on, relative where that reads better.
 *
 * The agenda can span the rest of the week, so a bare time is ambiguous the
 * moment anything past today is on it.
 */
export function agendaDay(at: string): string {
    const day = dayjs(at);

    if (day.isSame(dayjs(), "day")) return "Today";
    if (day.isSame(dayjs().add(1, "day"), "day")) return "Tomorrow";

    return day.format("ddd D MMM");
}
