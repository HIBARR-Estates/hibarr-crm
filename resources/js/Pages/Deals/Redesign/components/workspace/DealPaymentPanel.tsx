import { useMemo, useState } from "react";
import { App } from "antd";
import type { Deal } from "@/Types/api/deals";
import { copyToClipboard } from "@/lib/utils";
import { useApiQuery } from "@/lib/api/client";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useExchangeRate from "@/Hooks/useExchangeRate";
import useDealPayment from "../../hooks/useDealPayment";
import {
    isTerminalPaymentState,
    mapDealPaymentUiState,
} from "../../adapters/mapDealPaymentUiState";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import {
    formatMoneyAmount,
    useCompanyCurrency,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealPaymentPanelProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
}

interface CurrencyOption {
    id: number;
    currency_code: string;
    currency_symbol: string | null;
}

function formatTimestamp(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
}

/** A request's amount in the currency it was issued in. */
function requestMoney(request: DealPaymentRequest): string {
    return formatMoneyAmount(request.amount, {
        code: request.currency ?? "",
        symbol: request.currency_symbol || request.currency || "",
    });
}

export default function DealPaymentPanel({
    deal,
    canCreatePaymentRequest,
    canConfirmPaymentTransfer,
}: DealPaymentPanelProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const {
        paymentRequest,
        paymentRequests,
        paymentRequestLoading,
        createPaymentRequest,
        confirmTransfer,
        refreshStatus,
        creating,
        confirming,
        refreshing,
    } = useDealPayment(deal.id);

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

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [currencyCode, setCurrencyCode] = useState(companyCurrency.code);
    const [createError, setCreateError] = useState<string | null>(null);

    const { data: currencyData } = useApiQuery<{ data: CurrencyOption[] }>({
        path: route("form-data.index", "currencies"),
        options: { enabled: createOpen },
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
        createOpen,
    );
    // Preview only — the server recomputes this from the deal value at the
    // same cached rate, so what the client is asked to pay can't be edited.
    const convertedAmount = rate !== null ? Math.round(dealValue * rate * 100) / 100 : null;

    const mapped = useMemo(
        () => mapDealPaymentUiState(paymentRequest),
        [paymentRequest],
    );

    const history = useMemo(
        () => paymentRequests.filter((r) => r.id !== paymentRequest?.id),
        [paymentRequest?.id, paymentRequests],
    );

    const statusTimestamp =
        paymentRequest?.ui_state === "confirmed"
            ? formatTimestamp(paymentRequest.verified_at)
            : formatTimestamp(paymentRequest?.updated_at ?? paymentRequest?.created_at);

    const openCreateModal = () => {
        setCurrencyCode(companyCurrency.code);
        setCreateError(null);
        setCreateOpen(true);
    };

    const closeCreateModal = () => {
        setCreateOpen(false);
        setCreateError(null);
    };

    const handleCreate = async () => {
        setCreateError(null);
        const result = await createPaymentRequest({ currency: currencyCode });

        if (result.ok) {
            closeCreateModal();
            return;
        }

        setCreateError(result.message);
    };

    const handleCopyCheckoutUrl = async () => {
        if (!paymentRequest?.checkout_url) return;
        try {
            await copyToClipboard(paymentRequest.checkout_url);
            message.success(td("Checkout link copied."));
        } catch {
            message.error(td("Unable to copy checkout link."));
        }
    };

    if (paymentRequestLoading) {
        return (
            <p className="py-2 text-xs italic text-dr-text-hint">
                {td("Loading payment status...")}
            </p>
        );
    }

    const canSubmit = dealValue > 0 && rate !== null && !rateLoading && !creating;

    return (
        <div className="space-y-3">
            {!mapped.hasPaymentRequest ? (
                <>
                    <p className="text-xs text-dr-text-muted">
                        {td("Create a payment request to share a checkout link with the customer.")}
                    </p>
                    {canCreatePaymentRequest && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={openCreateModal}
                        >
                            {td("Create Payment Request")}
                        </Button>
                    )}
                </>
            ) : (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <Badge variant={paymentUiStateBadgeVariant(mapped.uiState!)}>
                            {td(paymentUiStateLabel(mapped.uiState!))}
                        </Badge>
                        {!isTerminalPaymentState(mapped.uiState) && (
                            <button
                                type="button"
                                onClick={() => void refreshStatus()}
                                disabled={refreshing}
                                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-dr-blue disabled:opacity-50"
                            >
                                {refreshing ? td("Refreshing...") : td("Refresh")}
                            </button>
                        )}
                    </div>

                    {paymentRequest && (
                        <p className="text-sm font-semibold text-dr-text">
                            {requestMoney(paymentRequest)}
                            {paymentRequest.base_amount !== null
                                && paymentRequest.base_currency
                                && paymentRequest.base_currency !== paymentRequest.currency && (
                                    <span className="ml-1.5 text-xs font-normal text-dr-text-muted">
                                        {`≈ ${formatMoneyAmount(paymentRequest.base_amount, {
                                            code: paymentRequest.base_currency,
                                            symbol:
                                                paymentRequest.base_currency_symbol
                                                || paymentRequest.base_currency,
                                        })}`}
                                    </span>
                                )}
                        </p>
                    )}

                    {statusTimestamp && (
                        <p className="text-xs text-dr-text-muted">
                            {td("Updated")}: {statusTimestamp}
                        </p>
                    )}

                    {paymentRequest?.verified_by && (
                        <p className="text-xs text-dr-text-muted">
                            {td("Confirmed by")} {paymentRequest.verified_by.name}
                            {paymentRequest.verified_at
                                ? ` · ${formatTimestamp(paymentRequest.verified_at)}`
                                : ""}
                        </p>
                    )}

                    {mapped.showCheckoutUrl && paymentRequest?.checkout_url && (
                        <div className="rounded-md border border-dr-border-soft bg-[#fafbfc] p-2.5">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-dr-text-muted">
                                {td("Checkout link")}
                            </p>
                            <a
                                href={paymentRequest.checkout_url}
                                target="_blank"
                                rel="noreferrer"
                                title={paymentRequest.checkout_url}
                                className="block break-all text-xs text-dr-blue"
                            >
                                {paymentRequest.checkout_url}
                            </a>
                            <button
                                type="button"
                                onClick={() => void handleCopyCheckoutUrl()}
                                className="mt-2 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-xs font-semibold text-dr-blue"
                            >
                                <Icon name="copy" size={12} />
                                {td("Copy link")}
                            </button>
                        </div>
                    )}

                    {mapped.showCheckoutUrl && !paymentRequest?.checkout_url && (
                        <p className="text-xs text-[#b45309]">
                            {td("Checkout link is not available yet. Refresh status or try again.")}
                        </p>
                    )}

                    {paymentRequest?.proof_url && (
                        <a
                            href={paymentRequest.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-dr-blue no-underline"
                        >
                            <Icon name="file-text" size={12} />
                            {td("View payment proof")}
                        </a>
                    )}

                    {mapped.canConfirm && canConfirmPaymentTransfer && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setConfirmOpen(true)}
                        >
                            {td("Confirm Transfer")}
                        </Button>
                    )}
                </>
            )}

            {history.length > 0 && (
                <div className="border-t border-dr-border-soft pt-2.5">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dr-text-muted">
                        {t("pages.deals.payment_request.history_title")}
                    </p>
                    <ul className="m-0 list-none space-y-1.5 p-0">
                        {history.map((request) => (
                            <li
                                key={request.id}
                                className="flex items-center justify-between gap-2 text-xs text-dr-text-muted"
                            >
                                <span className="min-w-0">
                                    <span className="font-medium text-dr-text line-through decoration-dr-text-hint">
                                        {requestMoney(request)}
                                    </span>
                                    {request.invalidated_at && (
                                        <span className="block text-[11px] text-dr-text-hint">
                                            {t("pages.deals.payment_request.invalidated_on", {
                                                date: formatTimestamp(request.invalidated_at) ?? "",
                                            })}
                                        </span>
                                    )}
                                </span>
                                <Badge variant={paymentUiStateBadgeVariant(request.ui_state)}>
                                    {td(paymentUiStateLabel(request.ui_state))}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <DealModal
                open={createOpen}
                title={td("Create Payment Request")}
                onClose={closeCreateModal}
            >
                <div className="space-y-3">
                    <p className="text-xs text-[#5b6472]">
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

                    <div className="space-y-1.5 rounded-md border border-dr-border-soft bg-[#fafbfc] p-3 text-xs">
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
                        <p className="text-xs text-[#b45309]">
                            {t("pages.deals.payment_request.no_deal_value")}
                        </p>
                    ) : rateUnavailable ? (
                        <p className="text-xs text-[#b45309]">
                            {t("pages.deals.payment_request.rate_unavailable")}
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
                        <Button variant="ghost" size="sm" onClick={closeCreateModal}>
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

            <ConfirmDialog
                open={confirmOpen}
                title={td("Confirm bank transfer?")}
                message={td(
                    "Confirm that the customer's bank transfer proof has been reviewed and approved.",
                )}
                confirmLabel={td("Yes, confirm")}
                cancelLabel={td("Cancel")}
                confirmLoading={confirming}
                onConfirm={() => {
                    void confirmTransfer().then((result) => {
                        if (result.ok) setConfirmOpen(false);
                    });
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
