import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadFinancials } from "../../hooks/useLeadFinancials";
import { formatDate, formatMoney } from "../../adapters/financialFormat";

/**
 * Compact summary for the Overview tab: the headline figures of the current
 * assessment, or a prompt when there is none / it is overdue for a refresh.
 * Renders nothing while loading, so the Overview never waits for it.
 */
export default function FinancialSnapshotCard({ financials, onOpen }: { financials: LeadFinancials; onOpen: () => void }) {
    const { t } = useTranslation();
    const data = financials.data;

    if (!data || !data.permissions.view) return null;

    const { summary, draft } = data;
    const crypto = data.options.crypto_currencies;
    const overdue = summary?.is_refresh_due ?? false;

    return (
        <section
            style={{
                background: overdue ? T.AMBER_BG : T.WHITE,
                border: `1px solid ${overdue ? T.AMBER_BORDER : T.BORDER}`,
                borderRadius: 12,
                padding: "14px 18px",
            }}
        >
            <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: overdue ? T.AMBER : T.TEXT }}>
                    {t("pages.leads.financials.snapshot.title")}
                </h2>
                {summary?.verified && <Badge variant="green">{t("pages.leads.financials.snapshot.verified")}</Badge>}
                {overdue && (
                    <Badge variant="amber">
                        {t("pages.leads.financials.fresh.overdue", { count: Math.abs(summary?.days_until_due ?? 0) })}
                    </Badge>
                )}
                {draft && <Badge variant="blue">{t("pages.leads.financials.snapshot.draft")}</Badge>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={onOpen}>
                    {t("pages.leads.financials.snapshot.open")}
                </Button>
            </div>

            {summary ? (
                <>
                    <div className="flex flex-wrap" style={{ gap: "10px 28px", marginTop: 12 }}>
                        {(
                            [
                                ["available_now", summary.available_now, T.BLUE_DARK],
                                ["disposable", summary.disposable_monthly, T.TEXT],
                                ["projected", summary.available_projected, T.TEXT],
                            ] as const
                        ).map(([key, value, color]) => (
                            <div key={key}>
                                <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>{t(`pages.leads.financials.snapshot.${key}`)}</div>
                                <div style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>
                                    {formatMoney(value, summary.currency, crypto)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: overdue ? T.AMBER : T.GREEN }}>
                        {overdue
                            ? t("pages.leads.financials.snapshot.last_assessed", { date: formatDate(summary.as_of_date) })
                            : t("pages.leads.financials.snapshot.assessed", {
                                  date: formatDate(summary.as_of_date),
                                  due: formatDate(summary.refresh_due_on),
                              })}
                    </p>
                </>
            ) : (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>{t("pages.leads.financials.snapshot.none")}</p>
            )}
        </section>
    );
}
