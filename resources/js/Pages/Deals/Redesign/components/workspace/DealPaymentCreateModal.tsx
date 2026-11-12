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

/**
 * "Create Payment Request": pick the currency the customer pays in, see the
 * converted amount, create it. Shared by the deal page's Payments panel and
 * the agent workspace's Payments card.
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

    const [currencyCode, setCurrencyCode] = useState(companyCurrency.code);
    const [createError, setCreateError] = useState<string | null>(null);

    // Each opening starts from the company currency with no stale error.
    useEffect(() => {
        if (!open) return;
        setCurrencyCode(companyCurrency.code);
        setCreateError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const { data: currencyData } = useApiQuery<{ data: CurrencyOption[] }>({
        path: route("form-data.index", "currencies"),
        options: { enabled: open },
    });
    const currencies = currencyData?.data ?? [];
    const selectedCurrency: CurrencyDisplay = useMemo(() => {
        const match = currencies.find((c) => c.currency_code === currencyCode);
        return match
            ? { code: match.currency_code, symbol: match.currency_symbol || match.currency_code }
            : currencyCode === companyCurrency.code
              ? companyCurrency
              : { code: currencyCode, symbol: currencyCode };
    }, [companyCurrency, currencies, currencyCode]);

    const { rate, loading: rateLoading, unavailable: rateUnavailable } = useExchangeRate(
        companyCurrency.code,
        currencyCode,
        open,
    );
    // Preview only — the server recomputes this from the deal value at the
    // same cached rate, so what the client is asked to pay can't be edited.
    const convertedAmount = rate !== null ? Math.round(dealValue * rate * 100) / 100 : null;

    const handleCreate = async () => {
        setCreateError(null);
        const result = await createPaymentRequest({ currency: currencyCode });

        if (result.ok) {
            onClose();
            return;
        }

        setCreateError(result.message);
    };

    const canSubmit = dealValue > 0 && rate !== null && !rateLoading && !creating;

    return (
        <DealModal
            open={open}
            title={td("Create Payment Request")}
            onClose={onClose}
        >
            <div className="space-y-3">
                <p className="text-xs text-dr-text-muted">
                    {td("The customer will choose how to pay on the checkout page.")}
                </p>
                <DealModalField label={t("pages.deals.payment_request.currency")}>
                    <select
                        className="dr-input"
                        value={currencyCode}
                        onChange={(e) => {
                            setCurrencyCode(e.target.value);
                            if (createError) setCreateError(null);
                        }}
                        aria-label={t("pages.deals.payment_request.currency")}
                    >
                        {/* The company currency is always offered, even
                            before the list loads. */}
                        {!currencies.some((c) => c.currency_code === companyCurrency.code) && (
                            <option value={companyCurrency.code}>{companyCurrency.code}</option>
                        )}
                        {currencies.map((currency) => (
                            <option key={currency.id} value={currency.currency_code}>
                                {currency.currency_code}
                            </option>
                        ))}
                    </select>
                </DealModalField>

                <div className="space-y-1.5 rounded-lg border border-dr-border-soft bg-dr-surface-2 p-3 text-xs">
                    <div className="flex justify-between gap-3 text-dr-text-muted">
                        <span>{t("pages.deals.payment_request.deal_value")}</span>
                        <span className="font-medium text-dr-text tabular-nums">
                            {formatMoneyAmount(dealValue, companyCurrency)}
                        </span>
                    </div>
                    {currencyCode !== companyCurrency.code && (
                        <div className="flex justify-between gap-3 text-dr-text-muted">
                            <span>{t("pages.deals.payment_request.exchange_rate")}</span>
                            <span className="font-medium text-dr-text tabular-nums">
                                {rateLoading
                                    ? t("pages.deals.payment_request.rate_loading")
                                    : rate !== null
                                      ? `1 ${companyCurrency.code} = ${rate} ${currencyCode}`
                                      : "—"}
                            </span>
                        </div>
                    )}
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
                    <p className="text-xs text-dr-amber-text">
                        {t("pages.deals.payment_request.no_deal_value")}
                    </p>
                ) : rateUnavailable ? (
                    <p className="text-xs text-dr-amber-text">
                        {t("pages.deals.payment_request.rate_unavailable")}
                    </p>
                ) : (
                    <p className="text-xs text-dr-text-hint">
                        {t("pages.deals.payment_request.conversion_hint", {
                            currency: currencyCode,
                        })}
                    </p>
                )}

                {createError && (
                    <p
                        role="alert"
                        className="rounded-lg border border-dr-red-mid bg-dr-red-soft px-3 py-2 text-xs text-dr-red"
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
