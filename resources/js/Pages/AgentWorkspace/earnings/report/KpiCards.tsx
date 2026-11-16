import useTranslation from "@/Hooks/useTranslation";
import type { ReportKpi, ReportRange } from "./types";

interface KpiCardsProps {
    range: ReportRange;
    kpi: ReportKpi | null;
    failed: boolean;
    onRetry: () => void;
}

const CARDS: Array<{ key: keyof ReportKpi["current"]; compare: keyof ReportKpi["previous"] | null }> = [
    { key: "leads", compare: "leads" },
    { key: "deals_created", compare: "deals_created" },
    { key: "deals_closed", compare: "deals_closed" },
    { key: "meetings", compare: "meetings" },
    { key: "lead_notes", compare: null },
    { key: "deal_notes", compare: null },
];

/** What the period before is called in "vs Oct": a short month, "Q3" or the year. */
function previousPeriod(range: ReportRange, prevStart: string, locale: string): string {
    const day = new Date(`${prevStart.slice(0, 10)}T12:00:00Z`);
    if (range === "year") return String(day.getUTCFullYear());
    if (range === "quarter") return `Q${Math.floor(day.getUTCMonth() / 3) + 1}`;
    const tag = !locale || locale === "en" || locale === "eng" ? "en-GB" : locale;
    return day.toLocaleDateString(tag, { month: "short", timeZone: "UTC" }).replace(/^Sept$/, "Sep");
}

/** "+6", "−2" or "±0": the change against the period before. */
function delta(now: number, before: number): string {
    const diff = now - before;
    if (diff === 0) return "±0";
    return `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`;
}

/**
 * The six cards under the title (L7-38): leads, deals created, deals closed,
 * meetings and the two kinds of notes. The first four say how much more or
 * less than the period before; the first names that period ("vs Oct"), as on
 * the board. Notes carry no comparison.
 */
export default function KpiCards({ range, kpi, failed, onRetry }: KpiCardsProps) {
    const { t, locale } = useTranslation();
    const vs = kpi ? t(`pages.agent_workspace.earnings.report.vs.${range}`, { period: previousPeriod(range, kpi.prev_start, locale) }) : "";

    return (
        <ul className="agent-ea__kpis" aria-busy={!kpi && !failed}>
            {CARDS.map(({ key, compare }, index) => {
                const value = kpi?.current[key];
                const diff = kpi && compare ? kpi.current[key] - kpi.previous[compare] : 0;
                const note = kpi && compare ? delta(kpi.current[key], kpi.previous[compare]) + (index === 0 ? ` ${vs}` : "") : "";
                const trend = Math.sign(diff);
                return (
                    <li key={key} className={`agent-ea__kpi${kpi ? "" : " is-loading"}`}>
                        <span className="agent-ea__kpi-label">{t(`pages.agent_workspace.earnings.report.cards.${key}`)}</span>
                        <b className="agent-ea__kpi-value">{value ?? "00"}</b>
                        <span className={`agent-ea__kpi-note${trend > 0 ? " is-up" : trend < 0 ? " is-down" : ""}`}>{note || " "}</span>
                    </li>
                );
            })}
            {failed ? (
                <li className="agent-ea__kpi-error" role="alert">
                    {t("pages.agent_workspace.earnings.report.cards_failed")}{" "}
                    <button type="button" className="agent-ea__link" onClick={onRetry}>
                        {t("pages.agent_workspace.earnings.report.retry")}
                    </button>
                </li>
            ) : null}
        </ul>
    );
}
