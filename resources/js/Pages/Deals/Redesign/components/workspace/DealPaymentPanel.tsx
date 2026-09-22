import { useMemo, useState } from "react";
import { App } from "antd";
import type { Deal } from "@/Types/api/deals";
import { copyToClipboard } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useDealPayment from "../../hooks/useDealPayment";
import {
    isTerminalPaymentState,
    mapDealPaymentUiState,
    paymentUiStateLabel,
} from "../../adapters/mapDealPaymentUiState";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { DealModal, DealModalField } from "../primitives/DealModal";

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

export default function DealPaymentPanel({
    deal,
    canCreatePaymentRequest,
    canConfirmPaymentTransfer,
}: DealPaymentPanelProps) {
    const { td } = useTd();
    const { message } = App.useApp();
    const {
        paymentRequest,
        paymentRequestLoading,
        createPaymentRequest,
        confirmTransfer,
        refreshStatus,
        creating,
        confirming,
        refreshing,
    } = useDealPayment(deal.id);

    // deals.currency_id is null on most rows (see DealValueBlock), so
    // deal.currency is routinely absent — resolve through the same
    // breakdown/company-currency fallback used there instead of guessing EUR.
    const companyCurrency = useCompanyCurrency();
    const currencyCode =
        deal.value_breakdown?.currency.deal_code
        ?? deal.value_breakdown?.currency.company_code
        ?? deal.currency?.currency_code
        ?? paymentRequest?.currency
        ?? companyCurrency.code
        ?? "EUR";

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [amount, setAmount] = useState(String(deal.value ?? ""));
    const [createError, setCreateError] = useState<string | null>(null);

    const mapped = useMemo(
        () => mapDealPaymentUiState(paymentRequest),
        [paymentRequest],
    );

    const statusLabel = paymentRequest
        ? td(paymentUiStateLabel(paymentRequest.ui_state))
        : td("No payment request");

    const statusTimestamp =
        paymentRequest?.ui_state === "confirmed"
            ? formatTimestamp(paymentRequest.verified_at)
            : formatTimestamp(paymentRequest?.updated_at ?? paymentRequest?.created_at);

    const openCreateModal = () => {
        setAmount(String(deal.value ?? ""));
        setCreateError(null);
        setCreateOpen(true);
    };

    const handleCreate = async () => {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            const msg = td("Enter a valid amount.");
            setCreateError(msg);
            message.error(msg);
            return;
        }

        setCreateError(null);
        const result = await createPaymentRequest({
            amount: parsedAmount,
            currency: currencyCode,
        });

        if (result.ok) {
            setCreateOpen(false);
            setCreateError(null);
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
                        <Badge variant={mapped.uiState === "failed" ? "red" : "gray"}>
                            {statusLabel}
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

            <DealModal
                open={createOpen}
                title={td("Create Payment Request")}
                onClose={() => {
                    setCreateOpen(false);
                    setCreateError(null);
                }}
            >
                <div className="space-y-3">
                    <p className="text-xs text-[#5b6472]">
                        {td("The customer will choose how to pay on the checkout page.")}
                    </p>
                    <DealModalField label={td("Amount")}>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value);
                                    if (createError) setCreateError(null);
                                }}
                                className="w-full rounded-md border border-[#d7dbe3] px-3 py-2 text-sm"
                            />
                            <span className="shrink-0 rounded-md bg-[#f3f4f6] px-2.5 py-2 text-sm font-semibold text-[#1a1f2e]">
                                {currencyCode}
                            </span>
                        </div>
                    </DealModalField>
                    {createError && (
                        <p
                            role="alert"
                            className="rounded-md border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]"
                        >
                            {createError}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setCreateOpen(false);
                                setCreateError(null);
                            }}
                        >
                            {td("Cancel")}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void handleCreate()}
                            disabled={creating}
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
