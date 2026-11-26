import { useEffect, useMemo, useState } from "react";
import Badge, { type BadgeVariant } from "@/Components/Redesign/primitives/Badge";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import {
    type DiffStatus,
    diffAssessments,
    formatDate,
    formatDelta,
    formatMoney,
} from "../../adapters/financialFormat";
import { useFrequencyLabel } from "./FinancialBits";
import type { FinAssessment, FinLine } from "./types";

interface FinancialCompareModalProps {
    open: boolean;
    onClose: () => void;
    /** Newest first; the first entry is the current assessment. */
    assessments: FinAssessment[];
    cryptoCurrencies: string[];
}

const STATUS_VARIANT: Record<DiffStatus, BadgeVariant> = {
    raised: "green",
    lowered: "amber",
    changed: "blue",
    new: "navy",
    removed: "red",
    unchanged: "gray",
};

/** Available-now trend across finalised assessments, as a small accessible line chart. */
function Trend({ assessments, currency, cryptoCurrencies }: { assessments: FinAssessment[]; currency: string; cryptoCurrencies: string[] }) {
    const { t } = useTranslation();
    const points = [...assessments]
        .reverse()
        .filter((assessment) => assessment.totals)
        .map((assessment) => ({ date: assessment.as_of_date, value: assessment.totals?.available_now ?? 0 }));

    if (points.length < 2) return null;

    const width = 300;
    const height = 120;
    const pad = 36;
    const min = Math.min(...points.map((p) => p.value));
    const max = Math.max(...points.map((p) => p.value));
    const span = max - min || 1;
    const x = (i: number) => pad + (i * (width - pad * 2)) / (points.length - 1);
    const y = (v: number) => 78 - ((v - min) / span) * 48 + 4;
    const label = points.map((p) => `${formatDate(p.date)}: ${formatMoney(p.value, currency, cryptoCurrencies)}`).join("; ");

    return (
        <section style={{ border: `1px solid ${T.BORDER}`, borderRadius: 12, padding: "12px 14px" }}>
            <h3 style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600 }}>{t("pages.leads.financials.compare.trend_title")}</h3>
            <p style={{ margin: "0 0 6px", fontSize: 12, color: T.TEXT_MUTED }}>{t("pages.leads.financials.compare.trend_help")}</p>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={t("pages.leads.financials.compare.trend_label", { values: label })} style={{ display: "block", maxWidth: 440 }}>
                <line x1={pad - 10} y1={94} x2={width - pad + 10} y2={94} stroke={T.BORDER} strokeWidth={1} />
                <polyline
                    points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
                    fill="none"
                    stroke={T.BLUE}
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
                {points.map((p, i) => {
                    const last = i === points.length - 1;
                    return (
                        <g key={p.date + i}>
                            <circle cx={x(i)} cy={y(p.value)} r={last ? 5.5 : 5} fill={last ? T.BLUE : T.WHITE} stroke={T.BLUE} strokeWidth={2.5} />
                            <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize={11} fontWeight={last ? 600 : 400} fill={last ? T.BLUE_DARK : T.GRAY_DARKER}>
                                {formatMoney(p.value, currency, cryptoCurrencies)}
                            </text>
                            <text x={x(i)} y={110} textAnchor="middle" fontSize={11} fill={T.TEXT_MUTED}>
                                {formatDate(p.date)}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </section>
    );
}

/** Line-by-line comparison of any two finalised assessments, plus the available-now trend. */
export default function FinancialCompareModal({ open, onClose, assessments, cryptoCurrencies }: FinancialCompareModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const frequencyLabel = useFrequencyLabel();
    const [newerId, setNewerId] = useState<number | null>(assessments[0]?.id ?? null);
    const [olderId, setOlderId] = useState<number | null>(assessments[1]?.id ?? null);

    useEffect(() => {
        if (!open) return;
        setNewerId(assessments[0]?.id ?? null);
        setOlderId(assessments[1]?.id ?? null);
    }, [open, assessments]);

    const newer = assessments.find((a) => a.id === newerId) ?? null;
    const older = assessments.find((a) => a.id === olderId) ?? null;
    const currency = newer?.currency ?? "";

    const rows = useMemo(() => (newer && older ? diffAssessments(newer, older) : []), [newer, older]);
    const counts = useMemo(() => {
        const result: Record<DiffStatus, number> = { raised: 0, lowered: 0, changed: 0, new: 0, removed: 0, unchanged: 0 };
        for (const row of rows) result[row.status] += 1;
        return result;
    }, [rows]);

    const options = assessments.map((a) => ({
        value: a.id,
        label: `${formatDate(a.as_of_date)}${a.id === assessments[0]?.id ? ` (${t("pages.leads.financials.history.current")})` : ""}`,
    }));

    const cell = (line: FinLine | null) =>
        line ? (
            <div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                    {formatMoney(line.amount, line.currency, cryptoCurrencies)}
                    {line.frequency !== "once" ? ` / ${frequencyLabel(line.frequency).toLowerCase()}` : ""}
                </div>
                <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                    {t(`pages.leads.financials.certainties.${line.certainty}`)}
                    {line.currency !== currency && line.converted_amount !== null ? ` · ≈ ${formatMoney(line.converted_amount, currency, cryptoCurrencies)}` : ""}
                </div>
            </div>
        ) : (
            <span style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.compare.not_recorded")}</span>
        );

    return (
        <Modal open={open} title={t("pages.leads.financials.compare.title")} subtitle={t("pages.leads.financials.compare.subtitle")} onClose={onClose} maxWidth={940} closeOnBackdrop>
            <div className="flex flex-col" style={{ gap: 16 }}>
                <div className="flex flex-wrap items-end" style={{ gap: 14 }}>
                    <div style={{ flex: "1 1 200px" }}>
                        <span style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>{t("pages.leads.financials.compare.newer")}</span>
                        <MenuSelect value={newerId ?? ""} fullWidth options={options} onChange={(value) => setNewerId(Number(value))} />
                    </div>
                    <div style={{ flex: "1 1 200px" }}>
                        <span style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED }}>{t("pages.leads.financials.compare.older")}</span>
                        <MenuSelect value={olderId ?? ""} fullWidth options={options} onChange={(value) => setOlderId(Number(value))} />
                    </div>
                </div>

                <div className="flex flex-wrap" style={{ gap: 8 }}>
                    {(["raised", "lowered", "changed", "new", "removed", "unchanged"] as DiffStatus[])
                        .filter((status) => counts[status] > 0)
                        .map((status) => (
                            <Badge key={status} variant={STATUS_VARIANT[status]}>
                                {t(`pages.leads.financials.compare.count_${status}`, { count: counts[status] })}
                            </Badge>
                        ))}
                </div>

                <div style={{ border: `1px solid ${T.BORDER}`, borderRadius: 12, overflowX: "auto" }}>
                    <div style={{ minWidth: 680 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.3fr 1.3fr 1fr", gap: 12, padding: "10px 16px", background: T.SURFACE_SUBTLE, fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, borderBottom: `1px solid ${T.BORDER_SOFT}` }}>
                            <span>{t("pages.leads.financials.cols.type")}</span>
                            <span>{older ? formatDate(older.as_of_date) : ""}</span>
                            <span>{newer ? formatDate(newer.as_of_date) : ""}</span>
                            <span>{t("pages.leads.financials.cols.change")}</span>
                        </div>
                        {rows.map((row) => {
                            const delta = row.delta !== null && row.delta !== 0 ? formatDelta(row.delta, 0, currency, ) : null;
                            return (
                                <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.3fr 1.3fr 1fr", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${T.BORDER_SOFT}`, background: row.status === "unchanged" ? undefined : T.BLUE_WASH_SOFT, fontSize: 14 }}>
                                    <div>
                                        <div style={{ fontWeight: 500 }}>{td(row.typeLabel, { source: "en" })}</div>
                                        <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                            {td(row.kindLabel, { source: "en" })}
                                            {row.contributor ? ` · ${row.contributor}` : ""}
                                        </div>
                                    </div>
                                    {cell(row.before)}
                                    {cell(row.after)}
                                    <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
                                        <Badge variant={STATUS_VARIANT[row.status]}>{t(`pages.leads.financials.compare.status_${row.status}`)}</Badge>
                                        {delta && <span style={{ fontSize: 12, fontWeight: 600 }}>{delta.text}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <Trend assessments={assessments} currency={currency} cryptoCurrencies={cryptoCurrencies} />
            </div>
        </Modal>
    );
}
