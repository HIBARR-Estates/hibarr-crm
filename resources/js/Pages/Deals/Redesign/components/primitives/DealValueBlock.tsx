import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import DealIcon from "./DealIcon";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import useDealValueUpdate from "../../hooks/useDealValueUpdate";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealValueBlockProps {
    deal: Deal;
    canEdit: boolean;
}

function formatMoney(amount: number | null | undefined, symbol: string) {
    if (amount == null) return "—";
    return `${symbol}${Number(amount).toLocaleString()}`;
}

/** Ported from v2.2's ValueBlock (deal-v2-2.jsx:1195-1261). */
export default function DealValueBlock({ deal, canEdit }: DealValueBlockProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [manualDraft, setManualDraft] = useState<string>(
        deal.value_breakdown?.manual_value != null
            ? String(deal.value_breakdown.manual_value)
            : "",
    );
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "right",
        maxHeight: 420,
    });
    const { update, isUpdating } = useDealValueUpdate(deal, canEdit);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e: MouseEvent) => {
            const target = e.target as Node;
            if (triggerRef.current?.contains(target)) return;
            if (menuRef.current?.contains(target)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const symbol = deal.currency?.currency_symbol ?? "";
    const breakdown = deal.value_breakdown;
    const valueSource = breakdown?.value_source ?? "manual";
    const finalValue = breakdown?.final_value ?? deal.value ?? null;

    const line = (label: string, val: string, strong?: boolean) => (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "5px 0",
                fontSize: 12,
            }}
        >
            <span style={{ color: T.TEXT_MUTED }}>{label}</span>
            <span style={{ fontWeight: strong ? 700 : 500, color: T.TEXT }}>
                {val}
            </span>
        </div>
    );

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 2,
            }}
        >
            <span style={{ fontSize: 11, color: T.TEXT_HINT }}>
                {t("pages.deals.info.fields.deal_value")}
            </span>
            <button
                ref={triggerRef}
                type="button"
                className="dr-editable"
                style={{ width: "auto" }}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => breakdown && setOpen((v) => !v)}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span
                        className="dr-editable-value"
                        style={{ fontSize: 14, fontWeight: 600 }}
                    >
                        {formatMoney(finalValue, symbol)}
                    </span>
                    {breakdown && (
                        <span style={{ color: T.TEXT_MUTED, display: "flex" }}>
                            <DealIcon
                                name={open ? "chevron-up" : "chevron-down"}
                                size={12}
                            />
                        </span>
                    )}
                </span>
            </button>
            {breakdown && (
                <span
                    style={{
                        fontSize: 10,
                        color: T.TEXT_HINT,
                        textTransform: "capitalize",
                    }}
                >
                    {valueSource}
                </span>
            )}

            {open &&
                breakdown &&
                floatStyle &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={menuRef}
                        className="dr-menu"
                        role="dialog"
                        aria-label="Value breakdown"
                        style={{
                            ...floatStyle,
                            minWidth: 280,
                            padding: 14,
                            textAlign: "left",
                        }}
                    >
                        <div className="dr-label" style={{ marginBottom: 8 }}>
                            {t("pages.deals.info.value_insight.title")}
                        </div>
                        {!!breakdown.products_total &&
                            line(
                                t("pages.deals.info.value_insight.properties"),
                                formatMoney(breakdown.products_total, symbol),
                            )}
                        {!!breakdown.packages_total &&
                            line(
                                t("pages.deals.info.value_insight.packages"),
                                formatMoney(breakdown.packages_total, symbol),
                            )}
                        {!!breakdown.gross_total &&
                            line(
                                t("pages.deals.info.value_insight.gross"),
                                formatMoney(breakdown.gross_total, symbol),
                            )}
                        {!!breakdown.discount_total &&
                            line(
                                t("pages.deals.info.value_insight.discount"),
                                `−${formatMoney(breakdown.discount_total, symbol)}`,
                            )}
                        <div
                            style={{
                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                                marginTop: 4,
                                paddingTop: 4,
                            }}
                        >
                            {line(
                                t("pages.deals.info.value_insight.calculated"),
                                formatMoney(breakdown.calculated_value, symbol),
                                true,
                            )}
                        </div>

                        {canEdit && (
                            <>
                                <div className="dr-label" style={{ margin: "12px 0 8px" }}>
                                    {t("pages.deals.info.value_insight.source")}
                                </div>
                                <div
                                    style={{ display: "flex", gap: 6, marginBottom: 10 }}
                                    role="group"
                                    aria-label="Value source"
                                >
                                    <button
                                        type="button"
                                        className="dr-filter"
                                        aria-pressed={valueSource === "manual"}
                                        disabled={isUpdating}
                                        style={{ opacity: isUpdating ? 0.6 : 1 }}
                                        onClick={() => update({ value_source: "manual" })}
                                    >
                                        {t("pages.deals.info.value_insight.source_manual")}
                                    </button>
                                    <button
                                        type="button"
                                        className="dr-filter"
                                        aria-pressed={valueSource === "calculated"}
                                        disabled={isUpdating}
                                        style={{ opacity: isUpdating ? 0.6 : 1 }}
                                        onClick={() => update({ value_source: "calculated" })}
                                    >
                                        {t("pages.deals.info.value_insight.source_calculated")}
                                    </button>
                                    {isUpdating && (
                                        <span
                                            aria-hidden="true"
                                            className="flex h-4 w-4 items-center justify-center"
                                        >
                                            <span
                                                className="animate-spin rounded-full border-2 border-current border-t-transparent"
                                                style={{ width: 12, height: 12, color: T.TEXT_MUTED }}
                                            />
                                        </span>
                                    )}
                                </div>
                                {valueSource === "manual" && (
                                    <input
                                        className="dr-input"
                                        inputMode="numeric"
                                        aria-label="Manual deal value"
                                        value={manualDraft}
                                        placeholder={`${symbol}0`}
                                        disabled={isUpdating}
                                        onChange={(e) =>
                                            setManualDraft(
                                                e.target.value.replace(/[^\d]/g, ""),
                                            )
                                        }
                                        onBlur={() => {
                                            if (manualDraft === "") return;
                                            update({ manual_value: Number(manualDraft) });
                                        }}
                                        style={{
                                            fontSize: 12,
                                            padding: "7px 10px",
                                            opacity: isUpdating ? 0.6 : 1,
                                        }}
                                    />
                                )}
                            </>
                        )}
                    </div>,
                    document.body,
                )}
        </div>
    );
}
