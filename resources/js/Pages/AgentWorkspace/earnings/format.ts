import type { CommissionLine, LevelCriterion } from "./types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

function isEnglish(locale: string): boolean {
    return !locale || locale === "en" || locale === "eng";
}

function dateLocale(locale: string): string | undefined {
    return isEnglish(locale) ? "en-GB" : locale;
}

/** British English abbreviates September to "Sept"; the boards read "Sep". */
function trimSept(text: string, locale: string): string {
    return isEnglish(locale) ? text.replace(/\bSept\b/, "Sep") : text;
}

/** "Nov" for a line from this year, "Nov 2025" for an older one. */
export function monthLabel(iso: string | null, locale: string, currentYear: number): string {
    if (!iso) return "—";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "—";
    return trimSept(
        at.toLocaleDateString(dateLocale(locale), {
            month: "short",
            ...(at.getFullYear() !== currentYear ? { year: "numeric" } : {}),
        }),
        locale,
    );
}

/** "November 2026" for a YYYY-MM-DD month start. */
export function longMonth(day: string, locale: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "October" for a YYYY-MM-DD month start. */
export function monthName(day: string, locale: string): string {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(locale), { month: "long", timeZone: "UTC" });
}

/** "31 Oct" for a YYYY-MM-DD day, with the year when it is not this year. */
export function dayMonth(day: string, locale: string, currentYear: number): string {
    const withYear = Number(day.slice(0, 4)) !== currentYear;
    return trimSept(
        new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString(dateLocale(locale), {
            day: "numeric",
            month: "short",
            ...(withYear ? { year: "numeric" } : {}),
            timeZone: "UTC",
        }),
        locale,
    );
}

/** "Mar 2026". */
export function monthYear(day: string, locale: string): string {
    return trimSept(new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString(dateLocale(locale), { month: "short", year: "numeric", timeZone: "UTC" }), locale);
}

/** "2 Sep" for a level change, with the year once it is not this year. */
export function historyDate(iso: string | null, locale: string, currentYear: number): string {
    if (!iso) return "—";
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "—";
    return trimSept(
        at.toLocaleDateString(dateLocale(locale), {
            day: "numeric",
            month: "short",
            ...(at.getFullYear() !== currentYear ? { year: "numeric" } : {}),
        }),
        locale,
    );
}

/** "yesterday", "3 days ago" for someone who joined within the week; null once it reads better as a month. */
export function joinedRecently(day: string | null, nowMs: number, t: Translate): string | null {
    if (!day) return null;
    const joined = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(joined)) return null;
    // Whole calendar days, today counted from the viewer's own midnight.
    const now = new Date(nowMs);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((today - joined) / 86_400_000);
    if (days < 0 || days > 7) return null;
    if (days <= 1) return days === 0 ? t("pages.agent_workspace.earnings.network.when.today") : t("pages.agent_workspace.earnings.network.when.yesterday");
    return t("pages.agent_workspace.earnings.network.when.days_ago", { count: days });
}

/** The line a commission reads as in the Package column: "Legal Service · own sale". */
export function packageLine(line: CommissionLine, t: Translate): string {
    const how = line.own
        ? t("pages.agent_workspace.earnings.table.own_sale")
        : line.from_agent
          ? t("pages.agent_workspace.earnings.table.downline_sale", { name: line.from_agent })
          : t("pages.agent_workspace.earnings.table.downline");
    return line.package ? `${line.package} · ${how}` : how;
}

/** "Weber · Kyrenia apartment" under a name: the surname, then the deal. */
export function dealSubline(person: string | null, deal: string | null): string {
    const name = (deal ?? "").trim();
    const surname = (person ?? "").trim().split(/\s+/).pop() ?? "";
    if (!surname) return name;
    if (!name) return surname;
    // The deal is often already named after the person ("Weber · Kyrenia apartment").
    return name.toLowerCase().startsWith(surname.toLowerCase()) ? name : `${surname} · ${name}`;
}

/** What a criterion measures, in the agent's words. */
export function criterionLabel(metric: LevelCriterion["metric"], t: Translate): string {
    return t(`pages.agent_workspace.earnings.level.metric.${metric}`);
}

/** Money for value metrics, a plain count for the rest. */
export function criterionAmount(metric: LevelCriterion["metric"], value: number, money: (value: number) => string, locale: string): string {
    if (metric === "vsa" || metric === "vsd" || metric === "vsa_vsd") return money(value);
    return Math.round(value).toLocaleString(!locale || locale === "en" || locale === "eng" ? "en-US" : locale);
}

/**
 * A commission amount with its cents: "€ 123.45". The ledger has to reconcile to the cent,
 * so unlike the Deals figures these are never rounded to whole units.
 */
export function formatCommission(value: number, symbol: string, locale: string): string {
    const numberLocale = isEnglish(locale) ? "en-US" : locale;
    return `${symbol} ${value.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
