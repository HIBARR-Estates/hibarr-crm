import useTranslation from "@/Hooks/useTranslation";
import { formatMoney } from "../deals/format";
import { dayMonth, monthName } from "./format";
import type { EarningsSummary } from "./types";

interface SummaryCardsProps {
    summary: EarningsSummary | null | undefined;
    currencySymbol: string;
}

/** The three figures on the band (L7-21): earned this month, pending payout, paid this year. */
export default function SummaryCards({ summary, currencySymbol }: SummaryCardsProps) {
    const { t, locale } = useTranslation();
    const money = (value: number) => formatMoney(value, currencySymbol, locale);
    const year = new Date().getFullYear();

    let delta = "";
    let pending = "";
    let paid = "";
    if (summary) {
        const month = monthName(summary.prev_month, locale);
        const diff = summary.earned_month - summary.earned_prev_month;
        delta =
            Math.round(diff) === 0
                ? t("pages.agent_workspace.earnings.cards.delta_same", { month, previous: money(summary.earned_prev_month) })
                : t(diff > 0 ? "pages.agent_workspace.earnings.cards.delta_up" : "pages.agent_workspace.earnings.cards.delta_down", {
                      amount: money(Math.abs(diff)),
                      month,
                      previous: money(summary.earned_prev_month),
                  });
        pending =
            summary.pending_count === 0
                ? t("pages.agent_workspace.earnings.cards.pending_none")
                : summary.pending_count === 1
                  ? t("pages.agent_workspace.earnings.cards.pending_one")
                  : t("pages.agent_workspace.earnings.cards.pending", { count: summary.pending_count });
        paid =
            summary.paid_count === 0
                ? t("pages.agent_workspace.earnings.cards.paid_none")
                : t(summary.paid_count === 1 ? "pages.agent_workspace.earnings.cards.paid_one" : "pages.agent_workspace.earnings.cards.paid", {
                      count: summary.paid_count,
                      date: summary.last_payout ? dayMonth(summary.last_payout, locale, year) : "—",
                  });
    }

    const cards = [
        { key: "earned", mark: "var(--dr-green)", label: t("pages.agent_workspace.earnings.cards.earned"), value: summary && money(summary.earned_month), note: delta },
        { key: "pending", mark: "var(--dr-time-done-solid)", label: t("pages.agent_workspace.earnings.cards.pending_label"), value: summary && money(summary.pending_amount), note: pending },
        { key: "paid", mark: "var(--dr-blue)", label: t("pages.agent_workspace.earnings.cards.paid_label"), value: summary && money(summary.paid_year), note: paid },
    ];

    return (
        <ul className="agent-ea__cards" aria-busy={!summary}>
            {cards.map((card) => (
                <li key={card.key} className={`agent-ea__card${summary ? "" : " is-loading"}`}>
                    <span className="agent-ea__card-label">
                        <span className="agent-ea__card-mark" style={{ background: card.mark }} aria-hidden="true" />
                        {card.label}
                    </span>
                    <b className="agent-ea__card-value">{card.value ?? "€ 0,000"}</b>
                    <span className="agent-ea__card-note">{card.note || " "}</span>
                </li>
            ))}
        </ul>
    );
}
