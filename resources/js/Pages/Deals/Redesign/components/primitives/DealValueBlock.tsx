import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tooltip } from "antd";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import { isDealValueLocked } from "@/lib/dealOutcome";
import {
    useCompanyCurrency,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import DealIcon from "./DealIcon";
import DealButton from "./DealButton";
import DealValueEditorModal from "./DealValueEditorModal";
import useFloatingMenuPosition from "../../hooks/useFloatingMenuPosition";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealValueBlockProps {
    deal: Deal;
    canEdit: boolean;
}

/** Ported from v2.2's ValueBlock (deal-v2-2.jsx:1195-1261). */
export default function DealValueBlock({ deal, canEdit }: DealValueBlockProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const floatStyle = useFloatingMenuPosition(open, triggerRef, {
        align: "right",
        maxHeight: 420,
    });

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

    const breakdown = deal.value_breakdown;
    const companyFallback = useCompanyCurrency();

    // deals.currency_id is null on most rows, so the deal's own currency
    // relation is routinely absent — the symbol has to fall back to the
    // company's or every figure renders as a bare number.
    const companyCurrency: CurrencyDisplay = {
        code: breakdown?.currency.company_code || companyFallback.code,
        symbol:
            breakdown?.currency.company_symbol ||
            companyFallback.symbol ||
            companyFallback.code,
    };
    const dealCurrency: CurrencyDisplay = {
        code: breakdown?.currency.deal_code || companyCurrency.code,
        symbol: breakdown?.currency.deal_symbol || companyCurrency.symbol,
    };

    /**
     * Always two decimals. Money columns that mix "£470,000" with "£5,428.88"
     * stop lining up on the decimal point, which is exactly where the eye
     * checks whether a column adds up.
     */
    const money = (amount: number | null | undefined, currency = dealCurrency) => {
        if (amount == null) return "—";
        const prefix = currency.symbol || currency.code || "";
        return `${prefix}${Number(amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const valueSource = breakdown?.value_source ?? "manual";
    const finalValue = breakdown?.final_value ?? deal.value ?? null;
    const valueLocked = isDealValueLocked(deal);
    const isConverted = !!breakdown?.currency.is_converted;
    const rate = breakdown?.currency.exchange_rate ?? 1;

    // The headline figure is always company currency — that is the number the
    // business is actually measured in, and the only one comparable across deals.
    const headlineValue = isConverted
        ? (breakdown?.final_value_company ?? finalValue)
        : finalValue;

    const line = (
        label: ReactNode,
        val: string,
        strong?: boolean,
        /**
         * The viewer's own row among several. A tinted pill that owns its
         * padding, rather than a background bleeding to the panel edges — the
         * latter reads as a stray selection highlight.
         */
        mine?: boolean,
        key?: string,
    ) => (
        <div
            key={key}
            style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: mine ? "6px 8px" : "5px 0",
                margin: mine ? "1px -8px" : undefined,
                borderRadius: mine ? 6 : undefined,
                background: mine ? T.NAVY_SOFT : undefined,
                fontSize: 13,
            }}
        >
            <span style={{ color: mine ? T.TEXT : T.TEXT_MUTED, minWidth: 0 }}>
                {label}
            </span>
            <span
                style={{
                    fontWeight: strong || mine ? 700 : 500,
                    color: T.TEXT,
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {val}
            </span>
        </div>
    );

    /**
     * Names the kind of arithmetic that follows. The panel stacks three
     * unrelated calculations — what the deal is worth, that figure in another
     * currency, and how commission divides it — which spacing alone did not
     * distinguish.
     */
    const section = (label: string, children: ReactNode) => (
        <div style={{ marginTop: 12 }}>
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.TEXT_HINT,
                    letterSpacing: 0.2,
                    marginBottom: 2,
                }}
            >
                {label}
            </div>
            {children}
        </div>
    );

    /** Readable role for a leg, in place of the raw engine leg type. */
    const roleLabel = (leg: { type: string; is_you: boolean }) => {
        if (leg.is_you) return t("pages.deals.info.value_insight.role_you");
        if (leg.type === "upline") return t("pages.deals.info.value_insight.role_upline");
        return t("pages.deals.info.value_insight.role_agent");
    };

    /** Name in full weight, role and rate trailing it quietly. */
    const legLabel = (leg: {
        agent_name: string;
        type: string;
        percentage: number | null;
        is_you: boolean;
    }) => (
        <span>
            <span style={{ color: T.TEXT, fontWeight: 600 }}>{leg.agent_name}</span>
            <span style={{ color: T.TEXT_HINT }}>
                {` · ${roleLabel(leg)}`}
                {leg.percentage != null ? ` · ${leg.percentage}%` : ""}
            </span>
        </span>
    );

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                // Shares a left start-edge with the close-date block and
                // DealAgentCard in the header row, instead of the previous
                // right-alignment that had it drifting the opposite way.
                alignItems: "flex-start",
                gap: 2,
            }}
        >
            <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                {t("pages.deals.info.fields.deal_value")}
            </span>
            <button
                ref={triggerRef}
                type="button"
                className="dr-editable dr-editable--lg"
                style={{ width: "auto" }}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => breakdown && setOpen((v) => !v)}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span
                        className="dr-editable-value"
                        style={{ fontSize: 15, fontWeight: 600 }}
                    >
                        {money(headlineValue, companyCurrency)}
                    </span>
                    {valueLocked && (
                        <Tooltip title={t("pages.deals.value_locked_tooltip")}>
                            <span
                                style={{ color: T.TEXT_MUTED, display: "flex" }}
                            >
                                <DealIcon name="lock" size={12} />
                            </span>
                        </Tooltip>
                    )}
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
                        fontSize: 12,
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
                        aria-label={t("pages.deals.info.value_insight.title")}
                        style={{
                            ...floatStyle,
                            minWidth: 340,
                            padding: 14,
                            textAlign: "left",
                        }}
                    >
                        <div className="dr-label" style={{ marginBottom: 8 }}>
                            {t("pages.deals.info.value_insight.title")}
                        </div>

                        {/* ── What the deal is worth, in its own currency ── */}
                        {section(
                            `${t("pages.deals.info.value_insight.section_value")}${
                                dealCurrency.code ? ` (${dealCurrency.code})` : ""
                            }`,
                            <>
                                {/* A manual deal is priced from one typed figure, so
                                    the component rows describe numbers it never used. */}
                                {valueSource === "manual"
                                    ? line(
                                          t("pages.deals.info.value_insight.editor.manual_value"),
                                          money(breakdown.base_value),
                                      )
                                    : (
                                          <>
                                              {!!breakdown.products_total &&
                                                  line(
                                                      t("pages.deals.info.value_insight.properties"),
                                                      money(breakdown.products_total),
                                                  )}
                                              {!!breakdown.packages_total &&
                                                  line(
                                                      t("pages.deals.info.value_insight.packages"),
                                                      money(breakdown.packages_total),
                                                  )}
                                              {/* Gross only adds information once
                                                  something is subtracted from it. */}
                                              {(!!breakdown.discount_total ||
                                                  !!breakdown.deduction_total) &&
                                                  line(
                                                      t("pages.deals.info.value_insight.gross"),
                                                      money(breakdown.gross_total),
                                                  )}
                                          </>
                                      )}
                                {!!breakdown.discount_total &&
                                    line(
                                        t("pages.deals.info.value_insight.discount"),
                                        `−${money(breakdown.discount_total)}`,
                                    )}
                                {!!breakdown.deduction_total &&
                                    line(
                                        breakdown.deduction_note ||
                                            t("pages.deals.info.value_insight.deduction"),
                                        `−${money(breakdown.deduction_total)}`,
                                    )}
                                {line(
                                    t("pages.deals.info.value_insight.final"),
                                    money(finalValue),
                                    true,
                                )}
                                {/* Only when the stored value has drifted from what
                                    the current inputs add up to. */}
                                {breakdown.computed_value !== breakdown.final_value &&
                                    line(
                                        t("pages.deals.info.value_insight.calculated"),
                                        money(breakdown.computed_value),
                                    )}
                            </>,
                        )}

                        {/* ── The same figure in company currency ── */}
                        {isConverted &&
                            section(
                                t("pages.deals.info.value_insight.section_conversion"),
                                <>
                                    {line(
                                        t("pages.deals.info.value_insight.exchange_rate"),
                                        `1 ${dealCurrency.code} = ${rate} ${companyCurrency.code}`,
                                    )}
                                    {line(
                                        t("pages.deals.info.value_insight.in_company_currency"),
                                        money(breakdown.final_value_company, companyCurrency),
                                        true,
                                    )}
                                </>,
                            )}

                        {/* ── How that figure divides ── */}
                        {breakdown.commission &&
                            section(
                                t("pages.deals.info.value_insight.section_commission"),
                                <>
                                    {/* Privileged view: the legs are the makeup of
                                        the total below them, so they sit above a
                                        dashed rule rather than reading as three
                                        more top-level rows. The system leg is not
                                        among them — it is the revenue line. */}
                                    {breakdown.commission.legs?.map((leg, index) =>
                                        line(
                                            legLabel(leg),
                                            money(leg.amount, companyCurrency),
                                            false,
                                            leg.is_you,
                                            `leg-${index}`,
                                        ),
                                    )}
                                    {breakdown.commission.paid != null && (
                                        <div
                                            style={{
                                                borderTop: `1px dashed ${T.BORDER}`,
                                                marginTop: 6,
                                                paddingTop: 2,
                                            }}
                                        >
                                            {line(
                                                t(
                                                    breakdown.commission.is_projected
                                                        ? "pages.deals.info.value_insight.commission_projected"
                                                        : "pages.deals.info.value_insight.commission_paid",
                                                ) +
                                                    (breakdown.commission.percentage != null
                                                        ? ` · ${breakdown.commission.percentage}%`
                                                        : ""),
                                                `−${money(breakdown.commission.paid, companyCurrency)}`,
                                                true,
                                            )}
                                        </div>
                                    )}
                                    {/* Unprivileged earner: their own figure only,
                                        with no total for it to look like part of. */}
                                    {breakdown.commission.own != null &&
                                        line(
                                            t(
                                                breakdown.commission.is_projected
                                                    ? "pages.deals.info.value_insight.your_commission_projected"
                                                    : "pages.deals.info.value_insight.your_commission",
                                            ) +
                                                (breakdown.commission.own_percentage != null
                                                    ? ` · ${breakdown.commission.own_percentage}%`
                                                    : ""),
                                            money(breakdown.commission.own, companyCurrency),
                                            true,
                                        )}
                                    {/* The company's margin is a narrower grant than
                                        the payout above, so the row is absent rather
                                        than blank. */}
                                    {breakdown.commission.revenue_to_company != null && (
                                        <div
                                            style={{
                                                borderTop: `1px solid ${T.BORDER_SOFT}`,
                                                marginTop: 6,
                                                paddingTop: 4,
                                            }}
                                        >
                                            {line(
                                                t("pages.deals.info.value_insight.revenue_to_company"),
                                                money(
                                                    breakdown.commission.revenue_to_company,
                                                    companyCurrency,
                                                ),
                                                true,
                                            )}
                                        </div>
                                    )}
                                    {breakdown.commission.is_projected && (
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: T.TEXT_HINT,
                                                marginTop: 4,
                                            }}
                                        >
                                            {t(
                                                "pages.deals.info.value_insight.commission_projected_hint",
                                            )}
                                        </div>
                                    )}
                                </>,
                            )}

                        {canEdit && !valueLocked && (
                            <div
                                style={{
                                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                                    marginTop: 12,
                                    paddingTop: 10,
                                }}
                            >
                                <DealButton
                                    variant="navy"
                                    size="sm"
                                    style={{ width: "100%" }}
                                    onClick={() => {
                                        setOpen(false);
                                        setEditorOpen(true);
                                    }}
                                >
                                    {t("pages.deals.info.value_insight.editor.open")}
                                </DealButton>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}

            <DealValueEditorModal
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                deal={deal}
                dealCurrency={dealCurrency}
                companyCurrency={companyCurrency}
            />
        </div>
    );
}
