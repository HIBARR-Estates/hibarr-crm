import Badge from "@/Components/Redesign/primitives/Badge";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { formatDate, formatDelta, formatMoney } from "../../adapters/financialFormat";
import type { FinAssessment, FinSummary } from "./types";

interface FinancialStatCardsProps {
    summary: FinSummary;
    current: FinAssessment;
    /** The assessment this one replaced, for the "+€4,000 vs 14 Jul" lines. */
    previous: FinAssessment | null;
    cryptoCurrencies: string[];
}

/** Freshness strip + the four headline figures + the projected / uncertain line. */
export default function FinancialStatCards({ summary, current, previous, cryptoCurrencies }: FinancialStatCardsProps) {
    const { t } = useTranslation();
    const currency = summary.currency;
    const money = (value: number) => formatMoney(value, currency, cryptoCurrencies);
    const before = previous?.totals ?? null;
    const comparedWith = previous ? formatDate(previous.as_of_date) : "";

    const overdue = summary.is_refresh_due;
    const daysLate = Math.abs(summary.days_until_due ?? 0);

    const frozen = Object.entries(current.totals?.rates ?? {}).filter(([code]) => code !== currency);

    const cards: Array<{
        key: string;
        label: string;
        value: number;
        before: number | null;
        hint: string;
        emphasis?: boolean;
        costly?: boolean;
    }> = [
        {
            key: "available_now",
            label: t("pages.leads.financials.stats.available_now"),
            value: summary.available_now,
            before: before?.available_now ?? null,
            hint: summary.available_now_overridden
                ? t("pages.leads.financials.stats.overridden")
                : t("pages.leads.financials.stats.available_now_hint"),
            emphasis: true,
        },
        {
            key: "income",
            label: t("pages.leads.financials.stats.income"),
            value: summary.income_monthly,
            before: before?.income_monthly ?? null,
            hint: t("pages.leads.financials.stats.income_hint"),
        },
        {
            key: "commitments",
            label: t("pages.leads.financials.stats.commitments"),
            value: summary.commitments_monthly,
            before: before?.commitments_monthly ?? null,
            hint: t("pages.leads.financials.stats.commitments_hint"),
            costly: true,
        },
        {
            key: "disposable",
            label: t("pages.leads.financials.stats.disposable"),
            value: summary.disposable_monthly,
            before: before?.disposable_monthly ?? null,
            hint: t("pages.leads.financials.stats.disposable_hint"),
        },
    ];

    return (
        <div className="flex flex-col" style={{ gap: 14 }}>
            <div
                className="flex flex-wrap items-center"
                style={{
                    gap: "8px 20px",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: overdue ? T.AMBER_BG : T.GREEN_LIGHT,
                    border: `1px solid ${overdue ? T.AMBER_BORDER : T.GREEN_MID}`,
                    color: overdue ? T.AMBER : T.GREEN_PRESSED,
                    fontSize: 13,
                }}
            >
                <strong style={{ fontWeight: 600 }}>
                    {overdue
                        ? t("pages.leads.financials.fresh.overdue", { count: daysLate })
                        : t("pages.leads.financials.fresh.up_to_date")}
                </strong>
                <span>
                    {overdue
                        ? t("pages.leads.financials.fresh.last_assessed", { date: formatDate(summary.as_of_date) })
                        : t("pages.leads.financials.fresh.due", {
                              date: formatDate(summary.refresh_due_on),
                              count: summary.days_until_due ?? 0,
                          })}
                </span>
                {frozen.length > 0 && (
                    <span>
                        {t("pages.leads.financials.fresh.rates_frozen", {
                            date: formatDate(current.totals?.rates_as_of ?? current.finalised_at),
                        })}
                    </span>
                )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
                {cards.map((card) => {
                    const delta = card.before === null ? null : formatDelta(card.value, card.before, currency);
                    // More commitments is a cost: an increase should not read as good news.
                    const good = delta ? (card.costly ? delta.direction === "down" : delta.direction === "up") : false;
                    return (
                        <div
                            key={card.key}
                            style={{
                                background: card.emphasis ? T.BLUE_WASH : T.WHITE,
                                border: `1px solid ${card.emphasis ? T.BLUE_MID : T.BORDER}`,
                                borderRadius: 12,
                                padding: "14px 16px",
                            }}
                        >
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.TEXT_MUTED }}>{card.label}</div>
                            <div
                                style={{
                                    marginTop: 6,
                                    fontSize: 26,
                                    fontWeight: 600,
                                    fontVariantNumeric: "tabular-nums",
                                    color: card.emphasis ? T.BLUE_DARK : T.TEXT,
                                }}
                            >
                                {money(card.value)}
                            </div>
                            {delta && (
                                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500, color: good ? T.GREEN : T.RED }}>
                                    {t("pages.leads.financials.stats.vs", { delta: delta.text, date: comparedWith })}
                                </div>
                            )}
                            <div style={{ marginTop: 2, fontSize: 12, color: T.TEXT_MUTED }}>{card.hint}</div>
                        </div>
                    );
                })}
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: "6px 20px", fontSize: 13, color: T.GRAY_DARKER, padding: "0 2px" }}>
                <span>
                    {t("pages.leads.financials.stats.projected")}{" "}
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>{money(summary.available_projected)}</strong>
                </span>
                {summary.uncertain_total > 0 && (
                    <span style={{ color: T.ORANGE_TEXT }}>
                        {t("pages.leads.financials.stats.uncertain")}{" "}
                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>{money(summary.uncertain_total)}</strong>
                    </span>
                )}
                {summary.available_now_overridden && current.override_reason && (
                    <Badge variant="amber" title={current.override_reason}>
                        {t("pages.leads.financials.stats.override_reason", { reason: current.override_reason })}
                    </Badge>
                )}
            </div>
        </div>
    );
}
