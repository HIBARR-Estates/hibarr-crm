import { useMemo, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealPayment from "../../hooks/useDealPayment";
import {
    canCancelPaymentRequest,
    isTerminalPaymentState,
} from "../../adapters/mapDealPaymentUiState";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import { formatMoneyAmount } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { REDESIGN_RADIUS, REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import SectionLabel from "@/Components/Redesign/primitives/SectionLabel";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import PaymentRequestDetailModal from "@/Components/Redesign/payment/PaymentRequestDetailModal";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";
import DealPaymentCreateModal from "./DealPaymentCreateModal";

interface DealPaymentPanelProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
}

function requestMoney(request: DealPaymentRequest): string {
    return formatMoneyAmount(request.amount, {
        code: request.currency ?? "",
        symbol: request.currency_symbol || request.currency || "",
    });
}

/**
 * Every request on the deal, newest first, numbered in the order they were
 * created. The number is what makes a cancelled request and the one that
 * replaced it readable as a sequence. Opening a row shows the checkout link,
 * the cancel / confirm actions, and the invoice or receipt.
 */
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
        cancelRequest,
        refreshStatus,
        confirming,
        cancelling,
        refreshing,
    } = useDealPayment(deal.id);

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const { newestFirst, sequence, total } = useMemo(() => {
        const chronological = [...paymentRequests].sort((a, b) => {
            const aTime = a.created_at ? Date.parse(a.created_at) : 0;
            const bTime = b.created_at ? Date.parse(b.created_at) : 0;
            if (aTime !== bTime) return aTime - bTime;
            return a.id - b.id;
        });
        return {
            newestFirst: [...chronological].reverse(),
            sequence: new Map(chronological.map((request, index) => [request.id, index + 1])),
            total: chronological.length,
        };
    }, [paymentRequests]);

    const selected = newestFirst.find((request) => request.id === selectedId) ?? null;
    const selectedIsActive = selected != null && selected.id === paymentRequest?.id;
    const showRefresh = paymentRequest != null && !isTerminalPaymentState(paymentRequest.ui_state);

    if (paymentRequestLoading && total === 0) {
        return (
            <p className="py-2 text-xs italic text-dr-text-hint">
                {td("Loading payment status...")}
            </p>
        );
    }

    return (
        <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
                <SectionLabel style={{ marginBottom: 0 }}>
                    {t("pages.deals.payment_request.sequence_title")}
                    {total > 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 500, letterSpacing: 0, textTransform: "none", color: T.TEXT_HINT }}>
                            {total}
                        </span>
                    )}
                </SectionLabel>
                <div className="flex items-center gap-2">
                    {showRefresh && (
                        <Button
                            variant="ghost"
                            size="sm"
                            loading={refreshing}
                            onClick={() => void refreshStatus()}
                        >
                            {td("Refresh")}
                        </Button>
                    )}
                    {!paymentRequest && canCreatePaymentRequest && (
                        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                            {td("Create Payment Request")}
                        </Button>
                    )}
                </div>
            </div>

            {total === 0 ? (
                <p className="text-xs text-dr-text-muted">
                    {td("Create a payment request to share a checkout link with the customer.")}
                </p>
            ) : (
                <>
                    <p className="text-xs leading-snug text-dr-text-hint">
                        {t("pages.deals.payment_request.sequence_hint")}
                    </p>
                    <ol className="m-0 list-none space-y-2 p-0">
                        {newestFirst.map((request) => {
                            const number = sequence.get(request.id) ?? 0;
                            const cancelled = request.ui_state === "invalidated";
                            const failed = request.ui_state === "failed";
                            const active = request.id === paymentRequest?.id;
                            const when = request.created_at
                                ? formatCompanyDateTime(request.created_at)
                                : null;
                            return (
                                <li key={request.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedId(request.id)}
                                        className="flex w-full cursor-pointer items-center gap-2.5 text-left"
                                        style={{
                                            padding: "10px 12px",
                                            background: T.SURFACE,
                                            border: `1px solid ${active ? T.BLUE : T.BORDER}`,
                                            borderRadius: REDESIGN_RADIUS.MD,
                                            boxShadow: active ? `inset 3px 0 0 ${T.BLUE}` : undefined,
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        <span
                                            style={{
                                                flex: "0 0 auto",
                                                minWidth: 28,
                                                height: 28,
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: REDESIGN_RADIUS.SM,
                                                background: active ? T.BLUE_LIGHT : T.SURFACE_2,
                                                color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                                fontSize: REDESIGN_TYPE.CAPTION,
                                                fontWeight: 700,
                                                fontVariantNumeric: "tabular-nums",
                                            }}
                                        >
                                            {number}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span
                                                className="block tabular-nums"
                                                style={{
                                                    fontSize: REDESIGN_TYPE.BODY_LG,
                                                    fontWeight: 600,
                                                    color: cancelled || failed ? T.TEXT_HINT : T.NAVY,
                                                    textDecoration: cancelled ? "line-through" : undefined,
                                                }}
                                            >
                                                {requestMoney(request)}
                                            </span>
                                            {when && (
                                                <span
                                                    className="block"
                                                    style={{
                                                        marginTop: 2,
                                                        fontSize: REDESIGN_TYPE.CAPTION,
                                                        color: T.TEXT_HINT,
                                                    }}
                                                >
                                                    {when}
                                                </span>
                                            )}
                                        </span>
                                        <Badge variant={paymentUiStateBadgeVariant(request.ui_state)}>
                                            {td(paymentUiStateLabel(request.ui_state))}
                                        </Badge>
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                </>
            )}

            <PaymentRequestDetailModal
                request={selected}
                sequence={selected ? sequence.get(selected.id) : null}
                sequenceTotal={total}
                open={selected != null}
                onClose={() => setSelectedId(null)}
                onCancel={
                    selected
                    && selectedIsActive
                    && canCancelPaymentRequest(selected.ui_state)
                    && (canCreatePaymentRequest || canConfirmPaymentTransfer)
                        ? () => setCancelOpen(true)
                        : undefined
                }
                onConfirm={
                    selected && selectedIsActive && selected.can_confirm && canConfirmPaymentTransfer
                        ? () => setConfirmOpen(true)
                        : undefined
                }
            />

            <DealPaymentCreateModal
                deal={deal}
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />

            <ConfirmDialog
                open={confirmOpen}
                zIndex={1400}
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

            <ConfirmDialog
                open={cancelOpen}
                zIndex={1400}
                danger
                title={t("pages.deals.payment_request.cancel_title")}
                message={t("pages.deals.payment_request.cancel_message")}
                confirmLabel={t("pages.deals.payment_request.cancel_confirm")}
                cancelLabel={t("pages.deals.payment_request.cancel")}
                confirmLoading={cancelling}
                onConfirm={() => {
                    void cancelRequest().then((result) => {
                        if (result.ok) setCancelOpen(false);
                    });
                }}
                onCancel={() => setCancelOpen(false)}
            />
        </div>
    );
}
