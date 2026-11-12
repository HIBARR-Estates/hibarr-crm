import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import { useApiQuery } from "@/lib/api/client";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useExchangeRate from "@/Hooks/useExchangeRate";
import { remainingDealBalance } from "../../adapters/mapDealPaymentUiState";
import useDealPayment from "../../hooks/useDealPayment";
import {
    formatMoneyAmount,
    useCompanyCurrency,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import Button from "@/Components/Redesign/primitives/Button";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealPaymentCreateModalProps {
    deal: Deal;
    open: boolean;
    onClose: () => void;
}

interface CurrencyOption {
    id: number;
    currency_code: string;
    currency_symbol: string | null;
}

/** Up to 8 decimals, trailing zeros trimmed, no scientific notation. */
function formatRate(rate: number): string {
    if (!Number.isFinite(rate) || rate <= 0) return "";
    return rate.toFixed(8).replace(/\.?0+$/, "");
}

/**
 * Keep a typed rate as digits plus one decimal point.
 *
 * A comma is a decimal mark (`1,25` → `1.25`), which is how de/ru/tr users
 * type a rate. Grouped amounts (`1.250,50`) keep their last separator as the
 * decimal mark. Anything else — a comma dropped into the middle of the
 * digits, or mixed separators that aren't a grouped number — stays as typed
 * so it fails to parse, instead of becoming a much larger rate.
 */
function sanitizeRate(value: string): string {
    const cleaned = value.replace(/[^\d.,]/g, "");
    const normalized = normalizeRateDecimal(cleaned);
    if (normalized === null) return cleaned;

    const [whole, decimals] = normalized.split(".");
    if (decimals === undefined) return whole ?? "";
    return `${whole}.${decimals.slice(0, 8)}`;
}

function normalizeRateDecimal(value: string): string | null {
    if (value === "") return "";

    const commas = value.split(",").length - 1;
    const dots = value.split(".").length - 1;

    if (commas === 1 && dots === 0) return value.replace(",", ".");
    if (commas === 0 && dots <= 1) return value;

    if (commas > 0 && dots > 0) {
        const decimalSep = value.lastIndexOf(",") > value.lastIndexOf(".") ? "," : ".";
        const groupSep = decimalSep === "," ? "." : ",";
        const parts = value.split(decimalSep);
        if (parts.length !== 2) return null;
        const groups = parts[0].split(groupSep);
        if (groups.some((group, index) => group === "" || (index > 0 && group.length !== 3))) {
            return null;
        }
        return `${groups.join("")}.${parts[1]}`;
    }

    const groups = value.split(commas > 0 ? "," : ".");
    if (groups.every((group, index) => group !== "" && (index === 0 || group.length === 3))) {
        return groups.join("");
    }

    return null;
}

function parseRate(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === ".") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * "Create Payment Request": pick checkout or cash, the company-currency
 * amount (the remainder by default, less when the customer pays in batches),
 * the currency, and the exchange rate. Shared by the deal page's Payments
 * panel and the agent workspace's Payments card.
 */
export default function DealPaymentCreateModal({ deal, open, onClose }: DealPaymentCreateModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { createPaymentRequest, creating, paymentRequests } = useDealPayment(deal.id);

    // Payment requests are always issued from the deal value in company
    // currency (the same currency the deal page presents it in).
    const companyFallback = useCompanyCurrency();
    const companyCurrency: CurrencyDisplay = {
        code: deal.value_breakdown?.currency.company_code || companyFallback.code || "EUR",
        symbol:
            deal.value_breakdown?.currency.company_symbol
            || companyFallback.symbol
            || companyFallback.code
            || "",
    };
    const dealValue = Number(deal.value ?? 0);
    const companyCode = companyCurrency.code;

    const remaining = remainingDealBalance(dealValue, paymentRequests);
    const confirmedBase = Math.round((dealValue - remaining) * 100) / 100;

    const [currencyCode, setCurrencyCode] = useState(companyCode);
    const [method, setMethod] = useState<"checkout" | "cash">("checkout");
    const [amountInput, setAmountInput] = useState("");
    const [amountEdited, setAmountEdited] = useState(false);
    const [rateInput, setRateInput] = useState("1");
    const [rateEdited, setRateEdited] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Each opening starts from the company currency, the remaining balance,
    // and checkout — with no stale error.
    useEffect(() => {
        if (!open) return;
        setCurrencyCode(companyCode);
        setMethod("checkout");
        setAmountEdited(false);
        setRateInput("1");
        setRateEdited(false);
        setCreateError(null);
    }, [open, companyCode]);

    useEffect(() => {
        if (!open || amountEdited) return;
        setAmountInput(remaining > 0 ? formatRate(remaining) : "");
    }, [open, amountEdited, remaining]);

    const { data: currencyData } = useApiQuery<{ data: CurrencyOption[] }>({
        path: route("form-data.index", "currencies"),
        options: { enabled: open },
    });
    const currencies = currencyData?.data ?? [];
    const selectedCurrency: CurrencyDisplay = useMemo(() => {
        const match = currencies.find((c) => c.currency_code === currencyCode);
        return match
            ? { code: match.currency_code, symbol: match.currency_symbol || match.currency_code }
            : currencyCode === companyCode
              ? companyCurrency
              : { code: currencyCode, symbol: currencyCode };
    }, [companyCode, companyCurrency, currencies, currencyCode]);

    const needsRate = currencyCode.toUpperCase() !== companyCode.toUpperCase();
    const {
        rate: liveRate,
        loading: rateLoading,
        unavailable: rateUnavailable,
        reload: reloadLiveRate,
    } = useExchangeRate(companyCode, currencyCode, open && needsRate);

    // Prefill from the live rate until the user types their own. The hook
    // clears `liveRate` before paint when the pair changes, so this never
    // copies the previous currency's rate into the new field.
    useEffect(() => {
        if (!open || !needsRate || rateEdited || rateLoading || liveRate === null) return;
        setRateInput(formatRate(liveRate));
    }, [open, needsRate, rateEdited, rateLoading, liveRate]);

    const parsedRate = needsRate ? parseRate(rateInput) : 1;
    const parsedBase = parseRate(amountInput);
    const amountTooHigh = parsedBase !== null && parsedBase - remaining > 0.009;
    // The customer pays this slice of the deal, converted at the rate on screen.
    const convertedAmount =
        parsedBase !== null && parsedRate !== null && !amountTooHigh
            ? Math.round(parsedBase * parsedRate * 100) / 100
            : null;
    const rateInvalid =
        needsRate && rateInput.trim() !== "" && (parsedRate === null || (parsedBase !== null && convertedAmount === 0));

    const handleCurrencyChange = (next: string) => {
        setCurrencyCode(next);
        setRateEdited(false);
        setRateInput(next.toUpperCase() === companyCode.toUpperCase() ? "1" : "");
        if (createError) setCreateError(null);
    };

    const handleUseLiveRate = () => {
        // The next live rate replaces whatever is in the field, including an edit.
        setRateEdited(false);
        reloadLiveRate();
    };

    const handleCreate = async () => {
        if (parsedRate === null || parsedBase === null || amountTooHigh) return;
        setCreateError(null);
        const result = await createPaymentRequest({
            currency: currencyCode,
            base_amount: parsedBase,
            ...(needsRate ? { exchange_rate: parsedRate } : {}),
            ...(method === "cash" ? { provider_key: "cash" as const } : {}),
        });

        if (result.ok) {
            onClose();
            return;
        }

        setCreateError(result.message);
    };

    const canSubmit =
        remaining > 0
        && parsedBase !== null
        && !amountTooHigh
        && parsedRate !== null
        && (convertedAmount ?? 0) > 0
        && !creating;

    return (
        <DealModal
            open={open}
            title={td("Create Payment Request")}
            onClose={onClose}
        >
            <div className="space-y-3">
                <DealModalField label={t("pages.deals.payment_request.method")}>
                    <select
                        className="dr-input"
                        value={method}
                        onChange={(e) => {
                            setMethod(e.target.value === "cash" ? "cash" : "checkout");
                            if (createError) setCreateError(null);
                        }}
                        aria-label={t("pages.deals.payment_request.method")}
                    >
                        <option value="checkout">{t("pages.deals.payment_request.method_checkout")}</option>
                        <option value="cash">{t("pages.deals.payment_request.method_cash")}</option>
                    </select>
                    <p className="mt-1.5 text-[11px] text-dr-text-hint">
                        {method === "cash"
                            ? t("pages.deals.payment_request.cash_hint")
                            : t("pages.deals.payment_request.checkout_hint")}
                    </p>
                </DealModalField>
                <DealModalField label={t("pages.deals.payment_request.amount")}>
                    <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                            <input
                                className="dr-input tabular-nums"
                                inputMode="decimal"
                                aria-label={t("pages.deals.payment_request.amount")}
                                aria-invalid={amountTooHigh || undefined}
                                value={amountInput}
                                placeholder="0"
                                onChange={(e) => {
                                    setAmountEdited(true);
                                    const next = sanitizeRate(e.target.value);
                                    const [whole, decimals] = next.split(".");
                                    setAmountInput(
                                        decimals === undefined ? next : `${whole}.${decimals.slice(0, 2)}`,
                                    );
                                    if (createError) setCreateError(null);
                                }}
                            />
                        </div>
                        <span className="text-xs font-medium text-dr-text">{companyCode}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] text-dr-text-hint">
                        {t("pages.deals.payment_request.amount_hint")}
                    </p>
                </DealModalField>
                <DealModalField label={t("pages.deals.payment_request.currency")}>
                    <select
                        className="dr-input"
                        value={currencyCode}
                        onChange={(e) => handleCurrencyChange(e.target.value)}
                        aria-label={t("pages.deals.payment_request.currency")}
                    >
                        {/* The company currency is always offered, even
                            before the list loads. */}
                        {!currencies.some((c) => c.currency_code === companyCode) && (
                            <option value={companyCode}>{companyCode}</option>
                        )}
                        {currencies.map((currency) => (
                            <option key={currency.id} value={currency.currency_code}>
                                {currency.currency_code}
                            </option>
                        ))}
                    </select>
                </DealModalField>

                {needsRate && (
                    <DealModalField label={t("pages.deals.payment_request.exchange_rate")}>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs tabular-nums text-dr-text-muted">
                                {`1 ${companyCode} =`}
                            </span>
                            <div className="w-32 shrink-0">
                                <input
                                    className="dr-input tabular-nums"
                                    inputMode="decimal"
                                    aria-label={t("pages.deals.payment_request.exchange_rate")}
                                    aria-invalid={rateInvalid || undefined}
                                    value={rateInput}
                                    placeholder={
                                        rateLoading
                                            ? t("pages.deals.payment_request.rate_loading")
                                            : "0"
                                    }
                                    onChange={(e) => {
                                        setRateEdited(true);
                                        setRateInput(sanitizeRate(e.target.value));
                                        if (createError) setCreateError(null);
                                    }}
                                />
                            </div>
                            <span className="text-xs font-medium text-dr-text">{currencyCode}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                loading={rateLoading}
                                onClick={handleUseLiveRate}
                            >
                                {t("pages.deals.payment_request.use_live_rate")}
                            </Button>
                        </div>
                        <p
                            className={`mt-1.5 text-[11px] ${
                                rateUnavailable && rateInput.trim() === ""
                                    ? "text-[#b45309]"
                                    : "text-dr-text-hint"
                            }`}
                        >
                            {rateLoading
                                ? t("pages.deals.payment_request.rate_loading")
                                : rateUnavailable && rateInput.trim() === ""
                                  ? t("pages.deals.payment_request.rate_unavailable")
                                  : t("pages.deals.payment_request.rate_editable_hint")}
                        </p>
                    </DealModalField>
                )}

                <div className="space-y-1.5 rounded-md border border-dr-border-soft bg-[#fafbfc] p-3 text-xs">
                    <div className="flex justify-between gap-3 text-dr-text-muted">
                        <span>{t("pages.deals.payment_request.deal_value")}</span>
                        <span className="font-medium text-dr-text tabular-nums">
                            {formatMoneyAmount(dealValue, companyCurrency)}
                        </span>
                    </div>
                    {confirmedBase > 0 && (
                        <div className="flex justify-between gap-3 text-dr-text-muted">
                            <span>{t("pages.deals.payment_request.confirmed_so_far")}</span>
                            <span className="font-medium text-dr-text tabular-nums">
                                {formatMoneyAmount(confirmedBase, companyCurrency)}
                            </span>
                        </div>
                    )}
                    <div className="flex justify-between gap-3 text-dr-text-muted">
                        <span>{t("pages.deals.payment_request.remaining")}</span>
                        <span className="font-medium text-dr-text tabular-nums">
                            {formatMoneyAmount(remaining, companyCurrency)}
                        </span>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-dr-border-soft pt-1.5 text-sm">
                        <span className="font-semibold text-dr-text">
                            {t("pages.deals.payment_request.amount_to_request")}
                        </span>
                        <span className="font-bold text-dr-text tabular-nums">
                            {convertedAmount !== null
                                ? formatMoneyAmount(convertedAmount, selectedCurrency)
                                : "—"}
                        </span>
                    </div>
                </div>

                {dealValue <= 0 ? (
                    <p className="text-xs text-[#b45309]">
                        {t("pages.deals.payment_request.no_deal_value")}
                    </p>
                ) : remaining <= 0 ? (
                    <p className="text-xs text-[#b45309]">
                        {t("pages.deals.payment_request.fully_covered")}
                    </p>
                ) : amountTooHigh ? (
                    <p className="text-xs text-[#b45309]">
                        {t("pages.deals.payment_request.amount_too_high")}
                    </p>
                ) : rateInvalid ? (
                    <p className="text-xs text-[#b45309]">
                        {t("pages.deals.payment_request.rate_required")}
                    </p>
                ) : needsRate ? (
                    <p className="text-[11px] text-dr-text-hint">
                        {t("pages.deals.payment_request.chosen_rate_hint", {
                            currency: currencyCode,
                        })}
                    </p>
                ) : (
                    <p className="text-[11px] text-dr-text-hint">
                        {t("pages.deals.payment_request.conversion_hint", {
                            currency: currencyCode,
                        })}
                    </p>
                )}

                {createError && (
                    <p
                        role="alert"
                        className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]"
                    >
                        {createError}
                    </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        {td("Cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void handleCreate()}
                        disabled={!canSubmit}
                    >
                        {creating ? td("Creating...") : td("Create")}
                    </Button>
                </div>
            </div>
        </DealModal>
    );
}
