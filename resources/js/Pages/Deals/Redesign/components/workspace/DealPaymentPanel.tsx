import { useMemo, useState } from "react";
import { message } from "antd";
import type { Deal } from "@/Types/api/deals";
import type { DealPaymentCreateInput } from "@/Types/api/deal-payment";
import { copyToClipboard } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useDealPayment from "../../hooks/useDealPayment";
import {
    isTerminalPaymentState,
    mapDealPaymentUiState,
    paymentUiStateLabel,
} from "../../adapters/mapDealPaymentUiState";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealPaymentPanelProps {
    deal: Deal;
    canManagePayments: boolean;
}

function formatTimestamp(value: string | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
}

export default function DealPaymentPanel({
    deal,
    canManagePayments,
}: DealPaymentPanelProps) {
    const { td } = useTd();
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

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [amount, setAmount] = useState(String(deal.value ?? ""));
    const [currency, setCurrency] = useState(deal.currency?.currency_code ?? "EUR");
    const [providerKey, setProviderKey] =
        useState<DealPaymentCreateInput["provider_key"]>("manual-bank-transfer");

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

    const handleCreate = async () => {
        const parsedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            message.error(td("Enter a valid amount."));
            return;
        }

        const created = await createPaymentRequest({
            amount: parsedAmount,
            currency,
            provider_key: providerKey,
        });

        if (created) {
            setCreateOpen(false);
        }
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
            <p className="py-2 text-xs italic text-[#9ca3af]">
                {td("Loading payment status...")}
            </p>
        );
    }

    return (
        <div className="space-y-3">
            {!mapped.hasPaymentRequest ? (
                <>
                    <p className="text-xs text-[#5b6472]">
                        {td("Create a payment request to share a checkout link with the customer.")}
                    </p>
                    {canManagePayments && (
                        <DealButton
                            variant="primary"
                            size="sm"
                            onClick={() => setCreateOpen(true)}
                        >
                            {td("Create Payment Request")}
                        </DealButton>
                    )}
                </>
            ) : (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <DealBadge variant={mapped.uiState === "failed" ? "red" : "gray"}>
                            {statusLabel}
                        </DealBadge>
                        {!isTerminalPaymentState(mapped.uiState) && (
                            <button
                                type="button"
                                onClick={() => void refreshStatus()}
                                disabled={refreshing}
                                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[#1a6bb5] disabled:opacity-50"
                            >
                                {refreshing ? td("Refreshing...") : td("Refresh")}
                            </button>
                        )}
                    </div>

                    {statusTimestamp && (
                        <p className="text-xs text-[#5b6472]">
                            {td("Updated")}: {statusTimestamp}
                        </p>
                    )}

                    {paymentRequest?.verified_by && (
                        <p className="text-xs text-[#5b6472]">
                            {td("Confirmed by")} {paymentRequest.verified_by.name}
                            {paymentRequest.verified_at
                                ? ` · ${formatTimestamp(paymentRequest.verified_at)}`
                                : ""}
                        </p>
                    )}

                    {mapped.showCheckoutUrl && paymentRequest?.checkout_url && (
                        <div className="rounded-md border border-[#eef0f3] bg-[#fafbfc] p-2.5">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#5b6472]">
                                {td("Checkout link")}
                            </p>
                            <p className="break-all text-xs text-[#1a1f2e]">
                                {paymentRequest.checkout_url}
                            </p>
                            <button
                                type="button"
                                onClick={() => void handleCopyCheckoutUrl()}
                                className="mt-2 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-xs font-semibold text-[#1a6bb5]"
                            >
                                <DealIcon name="copy" size={12} />
                                {td("Copy link")}
                            </button>
                        </div>
                    )}

                    {paymentRequest?.proof_url && (
                        <a
                            href={paymentRequest.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a6bb5] no-underline"
                        >
                            <DealIcon name="file-text" size={12} />
                            {td("View payment proof")}
                        </a>
                    )}

                    {mapped.canConfirm && canManagePayments && (
                        <DealButton
                            variant="primary"
                            size="sm"
                            onClick={() => setConfirmOpen(true)}
                        >
                            {td("Confirm Transfer")}
                        </DealButton>
                    )}
                </>
            )}

            <DealModal
                open={createOpen}
                title={td("Create Payment Request")}
                onClose={() => setCreateOpen(false)}
            >
                <div className="space-y-3">
                    <DealModalField label={td("Amount")}>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-md border border-[#d7dbe3] px-3 py-2 text-sm"
                        />
                    </DealModalField>
                    <DealModalField label={td("Currency")}>
                        <input
                            type="text"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                            className="w-full rounded-md border border-[#d7dbe3] px-3 py-2 text-sm"
                        />
                    </DealModalField>
                    <DealModalField label={td("Payment method")}>
                        <select
                            value={providerKey}
                            onChange={(e) =>
                                setProviderKey(
                                    e.target.value as DealPaymentCreateInput["provider_key"],
                                )
                            }
                            className="w-full rounded-md border border-[#d7dbe3] px-3 py-2 text-sm"
                        >
                            <option value="manual-bank-transfer">
                                {td("Bank transfer")}
                            </option>
                            <option value="nowpayments">{td("Crypto (NOWPayments)")}</option>
                        </select>
                    </DealModalField>
                    <div className="flex justify-end gap-2 pt-2">
                        <DealButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setCreateOpen(false)}
                        >
                            {td("Cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            size="sm"
                            onClick={() => void handleCreate()}
                            disabled={creating}
                        >
                            {creating ? td("Creating...") : td("Create")}
                        </DealButton>
                    </div>
                </div>
            </DealModal>

            <DealConfirmDialog
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
                        if (result) setConfirmOpen(false);
                    });
                }}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
}
