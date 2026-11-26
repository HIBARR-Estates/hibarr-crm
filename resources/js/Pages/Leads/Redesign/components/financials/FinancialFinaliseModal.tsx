import { useMemo, useState } from "react";
import { App } from "antd";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadFinancials } from "../../hooks/useLeadFinancials";
import { formatDate, formatDateTime, formatDelta, formatMoney } from "../../adapters/financialFormat";
import type { FinAssessment, FinDraft } from "./types";

interface FinancialFinaliseModalProps {
    open: boolean;
    financials: LeadFinancials;
    draft: FinDraft;
    /** The current final assessment this one will replace. */
    current: FinAssessment | null;
    cryptoCurrencies: string[];
    onClose: () => void;
    /** Called after a successful finalise. */
    onDone: () => void;
}

const SECTION_TITLE = { margin: "0 0 8px", fontSize: 14, fontWeight: 600 } as const;
const BOX = { border: `1px solid ${T.BORDER}`, borderRadius: 10, overflowX: "auto" } as const;

/**
 * Review and finalise. Shows what will change against the current assessment,
 * the exchange rates that will be frozen (and lets an admin type one in when a
 * provider could not supply it), and the optional, reasoned override of
 * "available now". Finalising is always a deliberate click here.
 */
export default function FinancialFinaliseModal({
    open,
    financials,
    draft,
    current,
    cryptoCurrencies,
    onClose,
    onDone,
}: FinancialFinaliseModalProps) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [manual, setManual] = useState<Record<string, string>>({});
    const [overrideOn, setOverrideOn] = useState(false);
    const [overrideAmount, setOverrideAmount] = useState("");
    const [reason, setReason] = useState("");

    const base = draft.currency;
    const money = (value: number) => formatMoney(value, base, cryptoCurrencies);
    const preview = draft.preview.totals;
    const before = current?.totals ?? null;

    const used = useMemo(
        () => [...new Set(draft.lines.map((line) => line.currency.toUpperCase()))].filter((code) => code !== base),
        [draft.lines, base],
    );
    const missing = useMemo(
        () => [...new Set([...draft.preview.missing_rates, ...(financials.failure?.missingRates ?? [])])],
        [draft.preview.missing_rates, financials.failure?.missingRates],
    );

    const manualValue = (code: string) => {
        const parsed = Number((manual[code] ?? "").replace(",", "."));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    };
    const unresolved = missing.filter((code) => manualValue(code) === null);
    const overrideValue = Number(overrideAmount.replace(",", "."));
    const overrideValid = !overrideOn || (overrideAmount.trim() !== "" && Number.isFinite(overrideValue) && overrideValue >= 0 && reason.trim() !== "");
    const canFinalise = draft.lines.length > 0 && unresolved.length === 0 && overrideValid && financials.pending === null;

    const submit = async () => {
        const manualRates: Record<string, number> = {};
        for (const code of missing) {
            const value = manualValue(code);
            if (value !== null) manualRates[code] = value;
        }
        const ok = await financials.finalise({
            manual_rates: manualRates,
            available_now_override: overrideOn ? overrideValue : null,
            override_reason: overrideOn ? reason.trim() : null,
        });
        if (ok) {
            message.success(t("pages.leads.financials.finalise.done"));
            onDone();
        }
    };

    const rows: Array<{ key: string; label: string; before: number | null; now: number; costly?: boolean; emphasis?: boolean }> = preview
        ? [
              { key: "available_now", label: t("pages.leads.financials.stats.available_now"), before: before?.available_now ?? null, now: preview.available_now, emphasis: true },
              { key: "projected", label: t("pages.leads.financials.stats.projected_short"), before: before?.available_projected ?? null, now: preview.available_projected },
              { key: "uncertain", label: t("pages.leads.financials.stats.uncertain_short"), before: before?.uncertain_total ?? null, now: preview.uncertain_total },
              { key: "income", label: t("pages.leads.financials.stats.income"), before: before?.income_monthly ?? null, now: preview.income_monthly },
              { key: "commitments", label: t("pages.leads.financials.stats.commitments"), before: before?.commitments_monthly ?? null, now: preview.commitments_monthly, costly: true },
              { key: "disposable", label: t("pages.leads.financials.stats.disposable"), before: before?.disposable_monthly ?? null, now: preview.disposable_monthly },
          ]
        : [];

    return (
        <Modal
            open={open}
            title={t("pages.leads.financials.finalise.title")}
            subtitle={t("pages.leads.financials.finalise.subtitle", { date: formatDate(draft.as_of_date), count: draft.lines.length })}
            onClose={onClose}
            maxWidth={820}
            zIndex={1400}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={financials.pending === "finalise"}>
                        {t("pages.leads.financials.finalise.back")}
                    </Button>
                    <Button variant="primary" onClick={() => void submit()} loading={financials.pending === "finalise"} disabled={!canFinalise}>
                        {t("pages.leads.financials.finalise.confirm")}
                    </Button>
                </>
            }
        >
            <div className="flex flex-col" style={{ gap: 18 }}>
                <section>
                    <h3 style={SECTION_TITLE}>{t("pages.leads.financials.finalise.what_title")}</h3>
                    <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3, fontSize: 13, color: T.GRAY_DARKER }}>
                        <li>
                            {current
                                ? t("pages.leads.financials.finalise.what_replaces", { date: formatDate(current.as_of_date) })
                                : t("pages.leads.financials.finalise.what_first")}
                        </li>
                        <li>{t("pages.leads.financials.finalise.what_frozen")}</li>
                        <li>{t("pages.leads.financials.finalise.what_verify")}</li>
                    </ul>
                </section>

                {financials.failure?.message && missing.length === 0 && (
                    <div role="alert" style={{ padding: "10px 14px", borderRadius: 10, background: T.RED_SOFT, border: `1px solid ${T.RED_MID}`, color: T.RED, fontSize: 13 }}>
                        {financials.failure.message}
                    </div>
                )}

                <section>
                    <h3 style={SECTION_TITLE}>{t("pages.leads.financials.finalise.totals_title")}</h3>
                    {preview ? (
                        <div style={BOX}>
                            <div style={{ minWidth: 520 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, padding: "9px 14px", background: T.SURFACE_SUBTLE, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                                    <span>{t("pages.leads.financials.finalise.figure")}</span>
                                    <span style={{ textAlign: "right" }}>{current ? formatDate(current.as_of_date) : t("pages.leads.financials.finalise.none_yet")}</span>
                                    <span style={{ textAlign: "right" }}>{t("pages.leads.financials.finalise.this_draft")}</span>
                                    <span style={{ textAlign: "right" }}>{t("pages.leads.financials.cols.change")}</span>
                                </div>
                                {rows.map((row) => {
                                    const delta = row.before === null ? null : formatDelta(row.now, row.before, base);
                                    const good = delta ? (row.costly ? delta.direction === "down" : delta.direction === "up") : false;
                                    return (
                                        <div key={row.key} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, padding: "9px 14px", alignItems: "center", borderBottom: `1px solid ${T.BORDER_SOFT}`, fontVariantNumeric: "tabular-nums", background: row.emphasis ? T.BLUE_WASH : undefined }}>
                                            <span style={{ fontWeight: 500 }}>{row.label}</span>
                                            <span style={{ textAlign: "right", color: T.TEXT_MUTED }}>{row.before === null ? "—" : money(row.before)}</span>
                                            <span style={{ textAlign: "right", fontWeight: 600 }}>{money(row.now)}</span>
                                            <span style={{ textAlign: "right", fontWeight: 600, color: good ? T.GREEN : T.RED }}>{delta?.text ?? ""}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: 13, color: T.AMBER }}>{t("pages.leads.financials.finalise.totals_blocked")}</p>
                    )}
                </section>

                {used.length > 0 && (
                    <section>
                        <h3 style={SECTION_TITLE}>{t("pages.leads.financials.finalise.rates_title")}</h3>
                        <div style={BOX}>
                            <div style={{ minWidth: 560 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.3fr 1.5fr", gap: 12, padding: "9px 14px", background: T.SURFACE_SUBTLE, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                                    <span>{t("pages.leads.financials.finalise.currency")}</span>
                                    <span>{t("pages.leads.financials.finalise.rate", { currency: base })}</span>
                                    <span>{t("pages.leads.financials.finalise.source")}</span>
                                    <span>{t("pages.leads.financials.finalise.fetched")}</span>
                                </div>
                                {used.map((code) => {
                                    const rate = draft.rates[code];
                                    const isMissing = missing.includes(code);
                                    return (
                                        <div key={code} style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1.3fr 1.5fr", gap: 12, padding: "9px 14px", alignItems: "center", borderBottom: `1px solid ${T.BORDER_SOFT}`, fontSize: 13 }}>
                                            <strong style={{ fontWeight: 600 }}>{code}</strong>
                                            {isMissing ? (
                                                <>
                                                    <span style={{ gridColumn: "2 / span 3", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", color: T.AMBER }}>
                                                        {t("pages.leads.financials.finalise.rate_missing", { ticker: code })}
                                                        <input
                                                            className="dr-input"
                                                            inputMode="decimal"
                                                            style={{ width: 150 }}
                                                            aria-label={t("pages.leads.financials.finalise.manual_rate", { ticker: code, currency: base })}
                                                            placeholder={t("pages.leads.financials.finalise.manual_placeholder")}
                                                            value={manual[code] ?? ""}
                                                            onChange={(event) => setManual((prev) => ({ ...prev, [code]: event.target.value }))}
                                                        />
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{rate ? formatMoney(rate.rate, base) : "—"}</span>
                                                    <span>{rate ? t(`pages.leads.financials.finalise.sources.${rate.source.replace(/[^a-z0-9]+/gi, "_")}`) : "—"}</span>
                                                    <span style={{ color: T.TEXT_MUTED }}>{formatDateTime(rate?.fetched_at)}</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        {missing.length > 0 && (
                            <div className="flex flex-wrap items-center" style={{ gap: 10, marginTop: 10 }}>
                                <Button variant="ghost" size="sm" onClick={() => void financials.refresh()} loading={financials.pending === "refresh"}>
                                    {t("pages.leads.financials.finalise.retry")}
                                </Button>
                                <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.leads.financials.finalise.manual_help")}</span>
                            </div>
                        )}
                    </section>
                )}

                <section style={{ border: `1px solid ${T.BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div className="flex items-start" style={{ gap: 10 }}>
                        <input
                            id="fin-override"
                            type="checkbox"
                            checked={overrideOn}
                            onChange={(event) => setOverrideOn(event.target.checked)}
                            style={{ marginTop: 3, width: 18, height: 18 }}
                        />
                        <div style={{ flex: 1 }}>
                            <label htmlFor="fin-override" style={{ fontWeight: 600 }}>
                                {t("pages.leads.financials.finalise.override_title")}
                            </label>
                            <p style={{ margin: "2px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                                {t("pages.leads.financials.finalise.override_help", {
                                    amount: preview ? money(preview.computed_available_now) : "—",
                                })}
                            </p>
                            {overrideOn && (
                                <div className="flex flex-wrap" style={{ gap: 12, marginTop: 10 }}>
                                    <div style={{ flex: "0 1 180px" }}>
                                        <label htmlFor="fin-override-amount" style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                                            {t("pages.leads.financials.finalise.override_amount", { currency: base })}
                                        </label>
                                        <input id="fin-override-amount" className="dr-input" inputMode="decimal" value={overrideAmount} onChange={(event) => setOverrideAmount(event.target.value)} />
                                    </div>
                                    <div style={{ flex: "1 1 260px" }}>
                                        <label htmlFor="fin-override-reason" style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>
                                            {t("pages.leads.financials.finalise.override_reason")}
                                        </label>
                                        <input id="fin-override-reason" className="dr-input" maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </Modal>
    );
}
