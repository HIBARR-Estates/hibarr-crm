import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import { formatDate, formatDateTime, formatMoney } from "../../adapters/financialFormat";
import { useSourceLabel } from "./FinancialBits";
import type { FinAssessment } from "./types";

interface FinancialHistoryRailProps {
    current: FinAssessment;
    history: FinAssessment[];
    cryptoCurrencies: string[];
    canEdit: boolean;
    verifying: boolean;
    onCompare: () => void;
    onVerify: () => void;
    onUpdate: () => void;
    updating: boolean;
}

/** Side rail: the assessment timeline, who reviewed the current one, and the refresh action. */
export default function FinancialHistoryRail({
    current,
    history,
    cryptoCurrencies,
    canEdit,
    verifying,
    onCompare,
    onVerify,
    onUpdate,
    updating,
}: FinancialHistoryRailProps) {
    const { t } = useTranslation();
    const sourceLabel = useSourceLabel();

    const card = { background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: "14px 16px" } as const;

    return (
        <aside className="flex flex-col" style={{ gap: 14 }}>
            <section style={card}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>{t("pages.leads.financials.history.title")}</h3>
                <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {history.map((item) => {
                        const isCurrent = item.id === current.id;
                        const totals = item.totals;
                        return (
                            <li
                                key={item.id}
                                style={{
                                    border: `1px solid ${isCurrent ? T.GREEN_MID : T.BORDER}`,
                                    background: isCurrent ? T.GREEN_LIGHT : T.WHITE,
                                    borderRadius: 10,
                                    padding: "10px 12px",
                                }}
                            >
                                <div className="flex items-center justify-between" style={{ gap: 8 }}>
                                    <strong style={{ fontWeight: 600, fontSize: 14 }}>
                                        {t("pages.leads.financials.history.assessment_of", { date: formatDate(item.as_of_date) })}
                                    </strong>
                                    <Badge variant={isCurrent ? "green" : "gray"}>
                                        {isCurrent
                                            ? t("pages.leads.financials.history.current")
                                            : t("pages.leads.financials.statuses.superseded")}
                                    </Badge>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13, color: T.TEXT_MUTED }}>
                                    {item.verified_at
                                        ? t("pages.leads.financials.history.meta_verified", {
                                              date: formatDate(item.verified_at),
                                              source: sourceLabel(item.source),
                                          })
                                        : t("pages.leads.financials.history.meta_unverified", { source: sourceLabel(item.source) })}
                                </div>
                                {totals && (
                                    <div style={{ marginTop: 6, fontSize: 13 }}>
                                        {t("pages.leads.financials.stats.available_now")}{" "}
                                        <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                                            {formatMoney(totals.available_now, item.currency, cryptoCurrencies)}
                                        </strong>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
                {history.length > 1 && (
                    <Button variant="ghost" onClick={onCompare} style={{ marginTop: 12, width: "100%" }}>
                        {t("pages.leads.financials.history.compare")}
                    </Button>
                )}
            </section>

            <section style={card}>
                <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 600 }}>{t("pages.leads.financials.review.title")}</h3>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "7px 14px", fontSize: 13 }}>
                    <dt style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.review.prepared")}</dt>
                    <dd style={{ margin: 0 }}>
                        {current.prepared_by?.name ?? "—"}
                    </dd>
                    <dt style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.review.finalised")}</dt>
                    <dd style={{ margin: 0 }}>{formatDateTime(current.finalised_at)}</dd>
                    <dt style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.review.verified")}</dt>
                    <dd style={{ margin: 0 }}>
                        {current.verified_at
                            ? t("pages.leads.financials.review.verified_by", {
                                  date: formatDateTime(current.verified_at),
                                  name: current.verified_by?.name ?? "—",
                              })
                            : t("pages.leads.financials.review.not_verified")}
                    </dd>
                    <dt style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.review.override")}</dt>
                    <dd style={{ margin: 0 }}>
                        {current.available_now_override !== null
                            ? t("pages.leads.financials.review.override_applied", {
                                  amount: formatMoney(current.available_now_override, current.currency, cryptoCurrencies),
                              })
                            : t("pages.leads.financials.review.override_none")}
                    </dd>
                </dl>
                {canEdit && !current.verified_at && (
                    <Button variant="ghost" onClick={onVerify} loading={verifying} style={{ marginTop: 12, width: "100%" }}>
                        {t("pages.leads.financials.review.verify")}
                    </Button>
                )}
            </section>

            {canEdit && (
                <section style={{ ...card, background: T.BLUE_WASH, borderColor: T.BLUE_MID }}>
                    <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600 }}>{t("pages.leads.financials.refresh.title")}</h3>
                    <p style={{ margin: "0 0 12px", fontSize: 13, color: T.GRAY_DARKER }}>{t("pages.leads.financials.refresh.body")}</p>
                    <Button variant="primary" onClick={onUpdate} loading={updating}>
                        {t("pages.leads.financials.update")}
                    </Button>
                </section>
            )}
        </aside>
    );
}
