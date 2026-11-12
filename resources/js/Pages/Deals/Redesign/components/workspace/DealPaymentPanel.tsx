import { useMemo, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealPayment from "../../hooks/useDealPayment";
import {
    isTerminalPaymentState,
    mapDealPaymentUiState,
    remainingDealBalance,
} from "../../adapters/mapDealPaymentUiState";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import { formatMoneyAmount } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";
import DealPaymentCreateModal from "./DealPaymentCreateModal";

interface DealPaymentPanelProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
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
    const {
        paymentRequest,
        paymentRequests,
        paymentRequestLoading,
        confirmTransfer,
        refreshStatus,
        confirming,
        refreshing,
    } = useDealPayment(deal.id);

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const mapped = useMemo(
        () => mapDealPaymentUiState(paymentRequest),
        [paymentRequest],
    );

    const history = useMemo(
        () => paymentRequests.filter((r) => r.id !== paymentRequest?.id),
        [paymentRequest?.id, paymentRequests],
    );

    const remaining = remainingDealBalance(Number(deal.value ?? 0), paymentRequests);
    const hasOpenRequest = paymentRequest !== null && !isTerminalPaymentState(mapped.uiState);
    const canRequestMore = canCreatePaymentRequest && remaining > 0 && !hasOpenRequest;
    const cashPending = mapped.uiState === "cash_pending";

    const statusTimestamp =
        paymentRequest?.ui_state === "confirmed"
            ? formatTimestamp(paymentRequest.verified_at)
            : formatTimestamp(paymentRequest?.updated_at ?? paymentRequest?.created_at);

    const openCreateModal = () => setCreateOpen(true);

    if (paymentRequestLoading) {
        return (
            <p className="py-2 text-xs italic text-dr-text-hint">
                {td("Loading payment status...")}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {!mapped.hasPaymentRequest ? (
                <>
                    <p className="text-xs text-dr-text-muted">
                        {td("Create a payment request to share a checkout link with the customer.")}
                    </p>
                    {canRequestMore && (
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
                        {!isTerminalPaymentState(mapped.uiState) && !cashPending && (
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
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dr-text-muted">
                                {t("pages.deals.payment_request.checkout_link")}
                            </p>
                            <CheckoutLinkActions url={paymentRequest.checkout_url} />
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
                            {cashPending
                                ? t("pages.deals.payment_request.confirm_cash")
                                : td("Confirm Transfer")}
                        </Button>
                    )}

                    {canRequestMore && (
                        <Button variant="primary" size="sm" onClick={openCreateModal}>
                            {t("pages.deals.payment_request.request_another")}
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
                                    <span
                                        className={
                                            request.ui_state === "failed" || request.ui_state === "invalidated"
                                                ? "font-medium text-dr-text line-through decoration-dr-text-hint"
                                                : "font-medium text-dr-text"
                                        }
                                    >
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

            <DealPaymentCreateModal
                deal={deal}
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />

            <ConfirmDialog
                open={confirmOpen}
                title={
                    cashPending
                        ? t("pages.deals.payment_request.confirm_cash_title")
                        : td("Confirm bank transfer?")
                }
                message={
                    cashPending
                        ? t("pages.deals.payment_request.confirm_cash_message")
                        : td("Confirm that the customer's bank transfer proof has been reviewed and approved.")
                }
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
