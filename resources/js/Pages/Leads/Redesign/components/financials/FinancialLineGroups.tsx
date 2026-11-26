import { useMemo } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadContactFile } from "@/Types/api/file";
import {
    diffAssessments,
    formatDate,
    formatDelta,
    formatMoney,
    groupLines,
} from "../../adapters/financialFormat";
import { CertaintyChip, RoleBadge, useFrequencyLabel } from "./FinancialBits";
import type { FinAssessment, FinKindOption, FinLine } from "./types";

const GRID = "1.7fr 1.1fr 1.3fr 0.9fr 1fr 1fr 1.3fr 0.9fr";

interface FinancialLineGroupsProps {
    assessment: FinAssessment;
    /** The assessment it replaced; drives the Change column. */
    previous: FinAssessment | null;
    kinds: FinKindOption[];
    files: LeadContactFile[];
    cryptoCurrencies: string[];
}

/** The lines of a finalised assessment, grouped by kind, with what changed since the previous one. */
export default function FinancialLineGroups({
    assessment,
    previous,
    kinds,
    files,
    cryptoCurrencies,
}: FinancialLineGroupsProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const frequencyLabel = useFrequencyLabel();
    const currency = assessment.currency;

    const groups = useMemo(() => groupLines(assessment.lines, kinds), [assessment.lines, kinds]);

    // Change per line, from a line-by-line comparison with the previous assessment.
    const changes = useMemo(() => {
        const byLine = new Map<number, ReturnType<typeof diffAssessments>[number]>();
        if (previous) {
            for (const row of diffAssessments(assessment, previous)) {
                if (row.after) byLine.set(row.after.id, row);
            }
        }
        return byLine;
    }, [assessment, previous]);

    const fileName = (id: number | null) => (id ? files.find((file) => file.id === id)?.filename ?? null : null);

    const changeCell = (line: FinLine) => {
        if (!previous) return <span style={{ color: T.TEXT_MUTED }}>—</span>;
        const row = changes.get(line.id);
        if (!row || row.status === "unchanged") {
            return <span style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.change.none")}</span>;
        }
        if (row.status === "new") {
            return <span style={{ color: T.BLUE_DARK, fontWeight: 600 }}>{t("pages.leads.financials.change.new")}</span>;
        }
        if (row.delta !== null && row.delta !== 0) {
            const delta = formatDelta(line.converted_amount ?? 0, (line.converted_amount ?? 0) - row.delta, currency);
            const costly = line.role === "commitment";
            const good = delta ? (costly ? delta.direction === "down" : delta.direction === "up") : false;
            return (
                <span style={{ color: good ? T.GREEN : T.RED, fontWeight: 600 }}>{delta?.text}</span>
            );
        }
        return <span style={{ color: T.TEXT_MUTED }}>{t("pages.leads.financials.change.edited")}</span>;
    };

    return (
        <div className="flex flex-col" style={{ gap: 14 }}>
            {groups.map((group) => {
                const counted = assessment.totals?.by_kind?.[group.kindKey];
                const recurring = group.role === "income" || group.role === "commitment";
                return (
                    <section
                        key={group.kindKey}
                        style={{ background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 12, overflow: "hidden" }}
                    >
                        <header
                            className="flex flex-wrap items-center"
                            style={{ gap: "6px 10px", padding: "12px 16px", background: T.SURFACE_SUBTLE, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                        >
                            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{td(group.kindLabel, { source: "en" })}</h3>
                            <RoleBadge role={group.role} />
                            {counted && (
                                <span className="ml-auto flex flex-wrap items-center" style={{ gap: "0 14px", fontSize: 13 }}>
                                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {formatMoney(counted.counted, currency, cryptoCurrencies)}
                                        {recurring ? ` ${t("pages.leads.financials.per_month")}` : ""}
                                    </strong>
                                    {counted.uncertain > 0 && (
                                        <span style={{ color: T.ORANGE_TEXT }}>
                                            {t("pages.leads.financials.not_counted", {
                                                amount: formatMoney(counted.uncertain, currency, cryptoCurrencies),
                                            })}
                                        </span>
                                    )}
                                </span>
                            )}
                        </header>
                        <div style={{ overflowX: "auto" }}>
                            <div style={{ minWidth: 860 }}>
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: GRID,
                                        gap: 12,
                                        padding: "9px 16px",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: T.TEXT_MUTED,
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                    }}
                                >
                                    <span>{t("pages.leads.financials.cols.type")}</span>
                                    <span>{t("pages.leads.financials.cols.amount")}</span>
                                    <span>{t("pages.leads.financials.cols.converted", { currency })}</span>
                                    <span>{t("pages.leads.financials.cols.frequency")}</span>
                                    <span>{t("pages.leads.financials.cols.available")}</span>
                                    <span>{t("pages.leads.financials.cols.certainty")}</span>
                                    <span>{t("pages.leads.financials.cols.proof")}</span>
                                    <span>{t("pages.leads.financials.cols.change")}</span>
                                </div>
                                {group.lines.map((line) => {
                                    const proof = fileName(line.proof_file_id);
                                    const counts = line.certainty !== "uncertain" || group.role === "commitment";
                                    return (
                                        <div
                                            key={line.id}
                                            style={{
                                                display: "grid",
                                                gridTemplateColumns: GRID,
                                                gap: 12,
                                                alignItems: "center",
                                                padding: "11px 16px",
                                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                                fontSize: 14,
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontWeight: 500 }}>{td(line.type_label, { source: "en" })}</div>
                                                {line.contributor_label && (
                                                    <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                                        {t("pages.leads.financials.contributor", { name: line.contributor_label })}
                                                    </div>
                                                )}
                                                {line.note && (
                                                    <div style={{ fontSize: 12, color: T.TEXT_MUTED }} title={line.note}>
                                                        {line.note.length > 48 ? `${line.note.slice(0, 48)}…` : line.note}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{ fontVariantNumeric: "tabular-nums" }}>
                                                {formatMoney(line.amount, line.currency, cryptoCurrencies)}
                                            </span>
                                            <div>
                                                <div style={{ fontVariantNumeric: "tabular-nums", color: counts ? undefined : T.TEXT_MUTED }}>
                                                    {line.converted_amount !== null
                                                        ? formatMoney(line.converted_amount, currency, cryptoCurrencies)
                                                        : "—"}
                                                </div>
                                                <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                                                    {line.rate !== null
                                                        ? t("pages.leads.financials.rate_frozen", {
                                                              ticker: line.currency,
                                                              rate: formatMoney(line.rate, currency),
                                                          })
                                                        : !counts
                                                          ? t("pages.leads.financials.not_counted_short")
                                                          : ""}
                                                </div>
                                            </div>
                                            <span>{frequencyLabel(line.frequency)}</span>
                                            <span>
                                                {line.available_from
                                                    ? formatDate(line.available_from)
                                                    : t("pages.leads.financials.available_now")}
                                            </span>
                                            <span>
                                                <CertaintyChip certainty={line.certainty} />
                                            </span>
                                            <span style={{ fontSize: 13, color: proof ? T.BLUE_DARK : T.TEXT_MUTED }}>
                                                {proof ?? t("pages.leads.financials.no_proof")}
                                            </span>
                                            <span style={{ fontSize: 13 }}>{changeCell(line)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
