import { useEffect, useMemo, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import { useApiQuery } from "@/lib/api/client";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useExchangeRate from "@/Hooks/useExchangeRate";
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

function sanitizeRate(value: string): string {
    const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    const [whole, decimals] = cleaned.split(".");
    if (decimals === undefined) return cleaned;
    return `${whole}.${decimals.slice(0, 8)}`;
}

function parseRate(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === ".") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * "Create Payment Request": pick the currency the customer pays in, confirm
 * or edit the exchange rate, see the converted amount, create it. Shared by
 * the deal page's Payments panel and the agent workspace's Payments card.
 */
export default function DealPaymentCreateModal({ deal, open, onClose }: DealPaymentCreateModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { createPaymentRequest, creating } = useDealPayment(deal.id);

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

    const [currencyCode, setCurrencyCode] = useState(companyCode);
    const [rateInput, setRateInput] = useState("1");
    const [rateEdited, setRateEdited] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Each opening starts from the company currency with no stale error.
    useEffect(() => {
        if (!open) return;
        setCurrencyCode(companyCode);
        setRateInput("1");
        setRateEdited(false);
        setCreateError(null);
    }, [open, companyCode]);

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
    // The amount follows the rate on screen, which is what gets saved.
    const convertedAmount = parsedRate !== null ? Math.round(dealValue * parsedRate * 100) / 100 : null;
    const rateInvalid =
        needsRate && rateInput.trim() !== "" && (parsedRate === null || convertedAmount === 0);

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
        if (parsedRate === null) return;
        setCreateError(null);
        const result = await createPaymentRequest({
            currency: currencyCode,
            ...(needsRate ? { exchange_rate: parsedRate } : {}),
        });

        if (result.ok) {
            onClose();
            return;
        }

        setCreateError(result.message);
    };

    const canSubmit =
        dealValue > 0 && parsedRate !== null && (convertedAmount ?? 0) > 0 && !creating;

    return (
        <DealModal
            open={open}
            title={td("Create Payment Request")}
            onClose={onClose}
        >
            <div className="space-y-3">
                <p className="text-xs text-[#5b6472]">
                    {td("The customer will choose how to pay on the checkout page.")}
                </p>
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
