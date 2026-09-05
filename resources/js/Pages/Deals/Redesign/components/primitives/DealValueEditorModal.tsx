import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Deal } from "@/Types/api/deals";
import useTranslation from "@/Hooks/useTranslation";
import { useApiQuery } from "@/lib/api/client";
import {
    formatMoneyAmount,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import DealButton from "./DealButton";
import DealMoneyInput from "./DealMoneyInput";
import DealSwitch from "./DealSwitch";
import { DealModal } from "./DealModal";
import RadioInput from "../analysis/inputs/RadioInput";
import useDealValueUpdate from "../../hooks/useDealValueUpdate";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface CurrencyOption {
    id: number;
    currency_code: string;
    currency_symbol: string | null;
}

interface DealValueEditorModalProps {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    dealCurrency: CurrencyDisplay;
    companyCurrency: CurrencyDisplay;
}

const numToInput = (value: number | null | undefined): string =>
    value === null || value === undefined || value === 0 ? "" : String(value);

const inputToNum = (value: string): number | null => {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Single place to edit everything that determines a deal's value: which figure
 * counts, the negotiated discount, any deduction, and the currency the value is
 * stated in with the rate back to company currency.
 *
 * Each optional adjustment sits behind a switch. A discount field standing
 * permanently at zero reads as "this deal has a discount of nothing", which is
 * a different claim from "this deal has no discount" — the switch is what makes
 * an adjustment deliberate.
 */
export default function DealValueEditorModal({
    open,
    onClose,
    deal,
    dealCurrency,
    companyCurrency,
}: DealValueEditorModalProps) {
    const { t } = useTranslation();
    const { update, isUpdating } = useDealValueUpdate(deal, true);
    const breakdown = deal.value_breakdown;

    const [valueSource, setValueSource] = useState<"manual" | "calculated">("calculated");
    const [manualValue, setManualValue] = useState("");
    const [hasDiscount, setHasDiscount] = useState(false);
    const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
    const [discountValue, setDiscountValue] = useState("");
    const [hasDeduction, setHasDeduction] = useState(false);
    const [deduction, setDeduction] = useState("");
    const [deductionNote, setDeductionNote] = useState("");
    const [currencyId, setCurrencyId] = useState<number | null>(null);
    const [rate, setRate] = useState("");
    const [rateLoading, setRateLoading] = useState(false);
    const [rateError, setRateError] = useState(false);

    // Reseed on every open: the dialog stays mounted between openings, so
    // abandoned edits would otherwise survive a cancel.
    useEffect(() => {
        if (!open) return;
        setValueSource(breakdown?.value_source ?? "calculated");
        setManualValue(numToInput(breakdown?.manual_value));
        setHasDiscount(!!breakdown?.discount_type);
        setDiscountType(breakdown?.discount_type ?? "percent");
        setDiscountValue(numToInput(breakdown?.discount_value));
        setHasDeduction(!!breakdown?.deduction_total);
        setDeduction(numToInput(breakdown?.deduction_total));
        setDeductionNote(breakdown?.deduction_note ?? "");
        setCurrencyId(deal.currency_id ?? null);
        setRate(numToInput(breakdown?.currency.exchange_rate));
        setRateError(false);
    }, [open, breakdown, deal.currency_id]);

    const { data: currencyData } = useApiQuery<{ data: CurrencyOption[] }>({
        path: route("form-data.index", "currencies"),
        options: { enabled: open },
    });
    const currencies = currencyData?.data ?? [];

    const selectedCurrency = currencies.find((c) => c.id === currencyId);

    // The company's own currency is already in this list, so offering a
    // separate "company default" entry alongside it listed EUR twice. The
    // default option IS the company currency row; the rest are the alternatives.
    const foreignCurrencies = currencies.filter(
        (c) => c.currency_code !== companyCurrency.code,
    );

    // The list arrives asynchronously, so until it does a deal that genuinely
    // has its own currency falls back to the breakdown's copy rather than
    // flashing as the company default and hiding the rate field.
    const resolvedCurrency: CurrencyDisplay | null =
        currencyId === null
            ? null
            : selectedCurrency
              ? {
                    code: selectedCurrency.currency_code,
                    // Fall back to the code only when the row genuinely has no
                    // symbol — never let a present symbol be skipped.
                    symbol:
                        selectedCurrency.currency_symbol || selectedCurrency.currency_code,
                }
              : dealCurrency;

    // A deal explicitly set to the company's currency is the same thing as one
    // with no currency of its own, so both land on the default option — and on
    // the company's symbol, which is where "€" went missing before.
    const activeCurrency: CurrencyDisplay =
        resolvedCurrency && resolvedCurrency.code !== companyCurrency.code
            ? resolvedCurrency
            : companyCurrency;
    const isCompanyDefault = activeCurrency.code === companyCurrency.code;

    // A rate is only meaningful once the deal is in a currency that differs
    // from the company's — hence currency first, rate second.
    const needsRate = !isCompanyDefault && !!companyCurrency.code;

    const fetchLiveRate = useCallback(
        async (from: string, to: string) => {
            setRateLoading(true);
            setRateError(false);
            try {
                const { data } = await axios.get(route("exchange-rate.show"), {
                    params: { from, to },
                    headers: { Accept: "application/json" },
                });
                if (data?.rate) setRate(String(data.rate));
                else setRateError(true);
            } catch {
                setRateError(true);
            } finally {
                setRateLoading(false);
            }
        },
        [],
    );

    const handleCurrencyChange = (id: number | null) => {
        setCurrencyId(id);
        const code = currencies.find((c) => c.id === id)?.currency_code;
        if (!code || !companyCurrency.code || code === companyCurrency.code) {
            setRate("");
            setRateError(false);
            return;
        }
        void fetchLiveRate(code, companyCurrency.code);
    };

    const effectiveRate = needsRate ? (inputToNum(rate) ?? 1) : 1;

    // Mirrors DealValueResolver::applyAdjustments() so the figure shown is the
    // one that will be saved, with no round-trip to find out. The discount and
    // deduction come off whichever base is active, manual included.
    const finalValue = useMemo(() => {
        const base =
            valueSource === "manual"
                ? (inputToNum(manualValue) ?? 0)
                : Math.max(
                      0,
                      (breakdown?.gross_total ?? 0) - (breakdown?.offer_discount_total ?? 0),
                  );

        const raw = hasDiscount ? (inputToNum(discountValue) ?? 0) : 0;
        const discount =
            base <= 0 || raw <= 0
                ? 0
                : discountType === "percent"
                  ? (base * Math.min(raw, 100)) / 100
                  : Math.min(raw, base);

        const deductionAmount = hasDeduction
            ? Math.min(
                  Math.max(0, inputToNum(deduction) ?? 0),
                  Math.max(0, base - discount),
              )
            : 0;

        return Math.max(0, base - discount - deductionAmount);
    }, [
        breakdown,
        hasDiscount,
        discountType,
        discountValue,
        hasDeduction,
        deduction,
        valueSource,
        manualValue,
    ]);

    const handleSave = async () => {
        const saved = await update({
            value_source: valueSource,
            manual_value: inputToNum(manualValue) ?? 0,
            currency_id: currencyId,
            exchange_rate: needsRate ? inputToNum(rate) : null,
            discount_type: hasDiscount ? discountType : null,
            discount_value: hasDiscount ? inputToNum(discountValue) : null,
            deduction_amount: hasDeduction ? inputToNum(deduction) : null,
            deduction_note: hasDeduction ? deductionNote.trim() || null : null,
        });
        if (saved) onClose();
    };

    const section = (label: string, children: ReactNode, control?: ReactNode) => (
        <div
            style={{
                borderTop: `1px solid ${T.BORDER_SOFT}`,
                paddingTop: 14,
                marginTop: 14,
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: children ? 10 : 0,
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT }}>
                    {label}
                </span>
                {control}
            </div>
            {children}
        </div>
    );

    return (
        <DealModal
            open={open}
            onClose={onClose}
            title={t("pages.deals.info.value_insight.editor.title")}
            subtitle={deal.name}
            maxWidth={560}
            footer={
                <>
                    <DealButton variant="ghost" onClick={onClose} disabled={isUpdating}>
                        {t("pages.deals.info.value_insight.editor.cancel")}
                    </DealButton>
                    <DealButton variant="navy" onClick={handleSave} loading={isUpdating}>
                        {t("pages.deals.info.value_insight.editor.save")}
                    </DealButton>
                </>
            }
        >
            {/* Where the value comes from */}
            <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.TEXT, marginBottom: 10 }}>
                    {t("pages.deals.info.value_insight.source")}
                </div>
                <RadioInput
                    value={valueSource}
                    onChange={(v) => setValueSource(v as "manual" | "calculated")}
                    options={[
                        {
                            value: "calculated",
                            label: t("pages.deals.info.value_insight.source_calculated"),
                        },
                        {
                            value: "manual",
                            label: t("pages.deals.info.value_insight.source_manual"),
                        },
                    ]}
                />
                {valueSource === "manual" && (
                    <div style={{ marginTop: 10 }}>
                        <DealMoneyInput
                            value={manualValue}
                            prefix={activeCurrency.symbol}
                            ariaLabel={t("pages.deals.info.value_insight.editor.manual_value")}
                            onChange={setManualValue}
                        />
                    </div>
                )}
            </div>

            {/* Discount — hidden until switched on */}
            {section(
                t("pages.deals.info.value_insight.editor.discount"),
                hasDiscount ? (
                    <>
                        <RadioInput
                            value={discountType}
                            onChange={(v) => setDiscountType(v as "percent" | "fixed")}
                            options={[
                                {
                                    value: "percent",
                                    label: t(
                                        "pages.deals.info.value_insight.editor.discount_percent",
                                    ),
                                },
                                {
                                    value: "fixed",
                                    label: t(
                                        "pages.deals.info.value_insight.editor.discount_fixed",
                                    ),
                                },
                            ]}
                        />
                        <div style={{ marginTop: 10 }}>
                            <DealMoneyInput
                                value={discountValue}
                                prefix={discountType === "percent" ? "%" : activeCurrency.symbol}
                                ariaLabel={t(
                                    "pages.deals.info.value_insight.editor.discount",
                                )}
                                onChange={setDiscountValue}
                            />
                        </div>
                    </>
                ) : null,
                <DealSwitch
                    checked={hasDiscount}
                    onChange={() => setHasDiscount((v) => !v)}
                    aria-label={t("pages.deals.info.value_insight.editor.discount")}
                />,
            )}

            {/* Deduction — hidden until switched on */}
            {section(
                t("pages.deals.info.value_insight.editor.deduction"),
                hasDeduction ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <DealMoneyInput
                            value={deduction}
                            prefix={activeCurrency.symbol}
                            ariaLabel={t("pages.deals.info.value_insight.editor.deduction")}
                            onChange={setDeduction}
                        />
                        <input
                            className="dr-input"
                            value={deductionNote}
                            placeholder={t(
                                "pages.deals.info.value_insight.editor.deduction_note",
                            )}
                            onChange={(e) => setDeductionNote(e.target.value)}
                        />
                    </div>
                ) : null,
                <DealSwitch
                    checked={hasDeduction}
                    onChange={() => setHasDeduction((v) => !v)}
                    aria-label={t("pages.deals.info.value_insight.editor.deduction")}
                />,
            )}

            {/* Currency first; the rate only exists once it differs */}
            {section(
                t("pages.deals.info.value_insight.editor.currency"),
                <>
                    <select
                        className="dr-input"
                        // A deal already on the company's currency resolves to
                        // the default option rather than a duplicate entry.
                        value={isCompanyDefault ? "" : String(currencyId)}
                        onChange={(e) =>
                            handleCurrencyChange(
                                e.target.value ? Number(e.target.value) : null,
                            )
                        }
                        aria-label={t("pages.deals.info.value_insight.editor.currency")}
                    >
                        <option value="">
                            {companyCurrency.code
                                ? `${companyCurrency.code} — ${t("pages.deals.info.value_insight.editor.currency_default")}`
                                : t("pages.deals.info.value_insight.editor.currency_default")}
                        </option>
                        {foreignCurrencies.map((currency) => (
                            <option key={currency.id} value={currency.id}>
                                {currency.currency_code}
                            </option>
                        ))}
                    </select>

                    {needsRate && (
                        <div style={{ marginTop: 10 }}>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: T.TEXT_MUTED,
                                    marginBottom: 6,
                                }}
                            >
                                {`1 ${activeCurrency.code} = ? ${companyCurrency.code}`}
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <DealMoneyInput
                                    value={rate}
                                    prefix={companyCurrency.symbol || ""}
                                    placeholder="1.0"
                                    disabled={rateLoading}
                                    ariaLabel={t(
                                        "pages.deals.info.value_insight.editor.exchange_rate",
                                    )}
                                    onChange={setRate}
                                />
                                <DealButton
                                    variant="ghost"
                                    size="sm"
                                    loading={rateLoading}
                                    onClick={() =>
                                        void fetchLiveRate(
                                            activeCurrency.code,
                                            companyCurrency.code,
                                        )
                                    }
                                >
                                    {t("pages.deals.info.value_insight.editor.refresh_rate")}
                                </DealButton>
                            </div>
                            <div
                                style={{
                                    fontSize: 11,
                                    color: rateError ? T.RED : T.TEXT_HINT,
                                    marginTop: 6,
                                }}
                            >
                                {rateError
                                    ? t("pages.deals.info.value_insight.editor.rate_unavailable")
                                    : t("pages.deals.info.value_insight.editor.rate_source")}
                            </div>
                        </div>
                    )}
                </>,
            )}

            {/* The one number this dialog exists to set */}
            <div
                style={{
                    borderTop: `1px solid ${T.BORDER}`,
                    marginTop: 18,
                    paddingTop: 14,
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 12,
                }}
            >
                <span style={{ fontSize: 13, fontWeight: 600, color: T.TEXT_MUTED }}>
                    {t("pages.deals.info.value_insight.final")}
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: T.TEXT }}>
                    {formatMoneyAmount(
                        needsRate ? finalValue * effectiveRate : finalValue,
                        needsRate ? companyCurrency : activeCurrency,
                    )}
                </span>
            </div>
            {needsRate && (
                <div
                    style={{
                        fontSize: 11,
                        color: T.TEXT_HINT,
                        textAlign: "right",
                        marginTop: 2,
                    }}
                >
                    {formatMoneyAmount(finalValue, activeCurrency)}
                </div>
            )}
        </DealModal>
    );
}
