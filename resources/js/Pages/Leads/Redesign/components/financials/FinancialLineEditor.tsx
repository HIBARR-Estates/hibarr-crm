import { useEffect, useState } from "react";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import MenuSelect from "@/Components/Redesign/primitives/MenuSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { LeadContactFile } from "@/Types/api/file";
import {
    CERTAINTY_ORDER,
    draftLineState,
    FREQUENCY_ORDER,
    formatDate,
    formatDelta,
    formatMoney,
} from "../../adapters/financialFormat";
import { useFrequencyLabel } from "./FinancialBits";
import type { FinCertainty, FinLine, FinLineInput } from "./types";

interface FinancialLineEditorProps {
    line: FinLine;
    /** Reporting currency of the draft. */
    baseCurrency: string;
    /** Date of the assessment this draft was copied from, for the "Copied from" tag. */
    copiedFrom: string | null;
    fiatCurrencies: string[];
    cryptoCurrencies: string[];
    files: LeadContactFile[];
    onChange: (lineId: number, input: FinLineInput) => void;
    onRemove: (lineId: number) => void;
}

const CERTAINTY_ACTIVE: Record<FinCertainty, { bg: string; color: string }> = {
    confirmed: { bg: T.GREEN_LIGHT, color: T.GREEN_PRESSED },
    likely: { bg: T.BLUE_LIGHT, color: T.BLUE_DARK },
    uncertain: { bg: T.AMBER_SOFT, color: T.ORANGE_TEXT },
};

/**
 * One line in the collect drawer. Text fields save when they lose focus,
 * choices save as soon as they are picked; each save is a request that returns
 * the whole refreshed tab payload.
 */
export default function FinancialLineEditor({
    line,
    baseCurrency,
    copiedFrom,
    fiatCurrencies,
    cryptoCurrencies,
    files,
    onChange,
    onRemove,
}: FinancialLineEditorProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const frequencyLabel = useFrequencyLabel();
    const [amount, setAmount] = useState(String(line.amount));
    const [contributor, setContributor] = useState(line.contributor_label ?? "");
    const [note, setNote] = useState(line.note ?? "");
    const [expanded, setExpanded] = useState(false);
    const idBase = `fin-line-${line.id}`;

    // The server's answer is the truth: re-sync local text when the line changes.
    useEffect(() => setAmount(String(line.amount)), [line.amount]);
    useEffect(() => setContributor(line.contributor_label ?? ""), [line.contributor_label]);
    useEffect(() => setNote(line.note ?? ""), [line.note]);

    const state = draftLineState(line);
    const currencies = [...new Set([...fiatCurrencies, ...cryptoCurrencies, line.currency])];
    const isForeign = line.currency !== baseCurrency;
    const label = td(line.type_label, { source: "en" });

    const commitAmount = () => {
        const parsed = Number(amount.replace(",", "."));
        if (amount.trim() === "" || Number.isNaN(parsed) || parsed < 0) {
            setAmount(String(line.amount));
            return;
        }
        if (parsed !== line.amount) onChange(line.id, { amount: parsed });
    };

    const delta =
        state === "edited" && line.previous && line.previous.currency === line.currency
            ? formatDelta(line.amount, line.previous.amount, line.currency, )
            : null;

    return (
        <div
            style={{
                padding: "12px 14px",
                borderTop: `1px solid ${T.BORDER_SOFT}`,
                background: state === "carried" ? T.WHITE : T.BLUE_WASH_SOFT,
            }}
        >
            <div className="flex flex-wrap items-end" style={{ gap: 10 }}>
                <div style={{ flex: "1 1 130px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    {line.contributor_label && (
                        <div style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                            {t("pages.leads.financials.contributor", { name: line.contributor_label })}
                        </div>
                    )}
                </div>
                <div style={{ flex: "0 1 130px" }}>
                    <input
                        id={`${idBase}-amount`}
                        className="dr-input"
                        inputMode="decimal"
                        aria-label={t("pages.leads.financials.editor.amount_for", { type: label })}
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        onBlur={commitAmount}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                    />
                </div>
                <MenuSelect
                    value={line.currency}
                    size="sm"
                    width={96}
                    options={currencies.map((code) => ({ value: code, label: code }))}
                    onChange={(value) => onChange(line.id, { currency: String(value) })}
                />
                <MenuSelect
                    value={line.frequency}
                    size="sm"
                    width={116}
                    options={FREQUENCY_ORDER.map((value) => ({ value, label: frequencyLabel(value) }))}
                    onChange={(value) => onChange(line.id, { frequency: value as FinLine["frequency"] })}
                />
                <Button
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="more" size={14} />}
                    aria-label={t("pages.leads.financials.editor.more", { type: label })}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((open) => !open)}
                />
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: "8px 12px", marginTop: 10 }}>
                <div
                    role="group"
                    aria-label={t("pages.leads.financials.editor.certainty_for", { type: label })}
                    style={{ display: "inline-flex", border: `1px solid ${T.BORDER}`, borderRadius: 8, overflow: "hidden" }}
                >
                    {CERTAINTY_ORDER.map((value) => {
                        const active = line.certainty === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => !active && onChange(line.id, { certainty: value })}
                                style={{
                                    minHeight: 32,
                                    padding: "0 12px",
                                    border: 0,
                                    borderRight: `1px solid ${T.BORDER_SOFT}`,
                                    cursor: "pointer",
                                    fontSize: 12,
                                    fontWeight: active ? 600 : 500,
                                    background: active ? CERTAINTY_ACTIVE[value].bg : T.WHITE,
                                    color: active ? CERTAINTY_ACTIVE[value].color : T.TEXT_MUTED,
                                }}
                            >
                                {t(`pages.leads.financials.certainties.${value}`)}
                            </button>
                        );
                    })}
                </div>
                {state === "carried" && copiedFrom && (
                    <Badge variant="gray">{t("pages.leads.financials.editor.copied_from", { date: formatDate(copiedFrom) })}</Badge>
                )}
                {state === "edited" && <Badge variant="blue">{t("pages.leads.financials.editor.edited")}</Badge>}
                {state === "new" && <Badge variant="navy">{t("pages.leads.financials.editor.new")}</Badge>}
                {state === "edited" && line.previous && (
                    <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                        {t("pages.leads.financials.editor.was", {
                            amount: formatMoney(line.previous.amount, line.previous.currency, cryptoCurrencies),
                        })}
                        {delta ? ` (${delta.text})` : ""}
                    </span>
                )}
                {line.certainty === "uncertain" && line.role !== "commitment" && (
                    <span style={{ fontSize: 12, color: T.ORANGE_TEXT }}>{t("pages.leads.financials.not_counted_short")}</span>
                )}
            </div>

            {isForeign && (
                <div
                    style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        background: line.rate !== null ? T.SURFACE_2 : T.AMBER_BG,
                        border: `1px solid ${line.rate !== null ? T.BORDER : T.AMBER_BORDER}`,
                        color: line.rate !== null ? T.GRAY_DARKER : T.AMBER,
                    }}
                >
                    {line.rate !== null && line.converted_amount !== null ? (
                        <>
                            <strong style={{ fontWeight: 600 }}>≈ {formatMoney(line.converted_amount, baseCurrency)}</strong>
                            {" · "}
                            {t("pages.leads.financials.editor.indicative", {
                                ticker: line.currency,
                                rate: formatMoney(line.rate, baseCurrency),
                            })}
                        </>
                    ) : (
                        t("pages.leads.financials.editor.no_rate", { ticker: line.currency })
                    )}
                </div>
            )}

            {expanded && (
                <div
                    className="flex flex-wrap"
                    style={{ gap: 12, marginTop: 12, padding: 12, background: T.SURFACE_SUBTLE, border: `1px solid ${T.BORDER_SOFT}`, borderRadius: 10 }}
                >
                    <div style={{ flex: "1 1 150px" }}>
                        <label htmlFor={`${idBase}-from`} className="dr-label" style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                            {t("pages.leads.financials.editor.available_from")}
                        </label>
                        <input
                            id={`${idBase}-from`}
                            type="date"
                            className="dr-input"
                            value={line.available_from ?? ""}
                            onChange={(event) => onChange(line.id, { available_from: event.target.value || null })}
                        />
                    </div>
                    <div style={{ flex: "1 1 170px" }}>
                        <label htmlFor={`${idBase}-who`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                            {t("pages.leads.financials.editor.contributor")}
                        </label>
                        <input
                            id={`${idBase}-who`}
                            className="dr-input"
                            maxLength={120}
                            placeholder={t("pages.leads.financials.editor.contributor_hint")}
                            value={contributor}
                            onChange={(event) => setContributor(event.target.value)}
                            onBlur={() => contributor.trim() !== (line.contributor_label ?? "") && onChange(line.id, { contributor_label: contributor.trim() || null })}
                        />
                    </div>
                    <div style={{ flex: "1 1 170px" }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                            {t("pages.leads.financials.editor.proof")}
                        </span>
                        <MenuSelect
                            value={line.proof_file_id ?? 0}
                            fullWidth
                            size="sm"
                            searchable={files.length > 8}
                            options={[
                                { value: 0, label: t("pages.leads.financials.no_proof") },
                                ...files.map((file) => ({ value: file.id, label: file.filename })),
                            ]}
                            onChange={(value) => onChange(line.id, { proof_file_id: Number(value) || null })}
                        />
                        {files.length === 0 && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: T.TEXT_MUTED }}>{t("pages.leads.financials.editor.proof_hint")}</p>
                        )}
                    </div>
                    <div style={{ flex: "1 1 100%" }}>
                        <label htmlFor={`${idBase}-note`} style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.TEXT_MUTED, marginBottom: 4 }}>
                            {t("pages.leads.financials.editor.note")}
                        </label>
                        <input
                            id={`${idBase}-note`}
                            className="dr-input"
                            maxLength={2000}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            onBlur={() => note.trim() !== (line.note ?? "") && onChange(line.id, { note: note.trim() || null })}
                        />
                    </div>
                    <div style={{ flex: "1 1 100%", display: "flex", justifyContent: "flex-end" }}>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Icon name="trash" size={14} />}
                            onClick={() => onRemove(line.id)}
                            style={{ color: T.RED }}
                        >
                            {t("pages.leads.financials.editor.remove")}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
