import { useState } from "react";
import { paymentUiStateBadgeVariant, paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import PaymentRequestDetailModal from "@/Components/Redesign/payment/PaymentRequestDetailModal";
import Button from "@/Components/Redesign/primitives/Button";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { canCancelPaymentRequest, isTerminalPaymentState, mapDealPaymentUiState } from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import DealPaymentCreateModal from "@/Pages/Deals/Redesign/components/workspace/DealPaymentCreateModal";
import useDealPayment from "@/Pages/Deals/Redesign/hooks/useDealPayment";
import { formatMoneyAmount } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import type { Deal } from "@/Types/api/deals";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";
import SectionCard, { SectionEmpty, SectionSkeleton } from "./SectionCard";

interface PaymentsSectionProps {
    deal: Deal;
    canCreate: boolean;
    canConfirmTransfer: boolean;
}

/** A request's amount in the currency it was issued in. */
const requestMoney = (request: DealPaymentRequest) =>
    formatMoneyAmount(request.amount, { code: request.currency ?? "", symbol: request.currency_symbol || request.currency || "" });

/**
 * The deal's payment requests, newest first and numbered in creation order.
 * Details, cancel, and the invoice or receipt live in the shared request modal.
 */
export default function PaymentsSection({ deal, canCreate, canConfirmTransfer }: PaymentsSectionProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const { paymentRequest, paymentRequests, paymentRequestLoading, confirmTransfer, cancelRequest, refreshStatus, confirming, cancelling, refreshing } =
        useDealPayment(deal.id);
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const mapped = mapDealPaymentUiState(paymentRequest);
    const ordered = [...paymentRequests].sort((a, b) => {
        const aTime = a.created_at ? Date.parse(a.created_at) : 0;
        const bTime = b.created_at ? Date.parse(b.created_at) : 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.id - b.id;
    });
    const sequence = new Map(ordered.map((request, index) => [request.id, index + 1]));
    const newestFirst = [...ordered].reverse();
    const selected = newestFirst.find((request) => request.id === selectedId) ?? null;
    const stamp = (request: DealPaymentRequest) =>
        request.ui_state === "confirmed" && request.verified_at
            ? t("pages.agent_workspace.deal.payments.confirmed_on", { date: formatDateTime(request.verified_at) })
            : formatDateTime(request.updated_at ?? request.created_at);

    return (
        <SectionCard
            id="deal-payments"
            title={t("pages.agent_workspace.deal.payments.title")}
            action={
                canCreate ? (
                    <Button size="sm" className="agent-btn-soft" onClick={() => setCreateOpen(true)}>
                        <Icon name="plus" size={12} />
                        {t("pages.agent_workspace.deal.payments.request")}
                    </Button>
                ) : null
            }
        >
            {paymentRequestLoading && paymentRequests.length === 0 ? (
                <SectionSkeleton />
            ) : paymentRequests.length === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.payments.empty")}</SectionEmpty>
            ) : (
                <ul className="agent-deal__rows">
                    {newestFirst.map((request) => {
                        const live = request.id === paymentRequest?.id;
                        const number = sequence.get(request.id);
                        return (
                            <li
                                key={request.id}
                                className={`agent-deal__row agent-deal__row--payment${live ? "" : " agent-deal__row--past"}`}
                            >
                                <span className="agent-deal__row-top">
                                    <span className="agent-deal__row-body">
                                        <span className="agent-deal__row-title">
                                            {`#${number} · ${requestMoney(request)}`}
                                        </span>
                                        <span className="agent-deal__row-sub">{stamp(request)}</span>
                                    </span>
                                    <span className={`agent-deal__status agent-deal__status--${paymentUiStateBadgeVariant(request.ui_state)}`}>
                                        {td(paymentUiStateLabel(request.ui_state))}
                                    </span>
                                </span>
                                {live && mapped.showCheckoutUrl && request.checkout_url ? (
                                    <CheckoutLinkActions url={request.checkout_url} />
                                ) : null}
                                {live && request.proof_url ? (
                                    <a className="agent-deal__link" href={request.proof_url} target="_blank" rel="noreferrer">
                                        <Icon name="file-text" size={12} />
                                        {t("pages.agent_workspace.deal.payments.proof")}
                                    </a>
                                ) : null}
                                <span className="agent-deal__row-actions">
                                    <Button size="sm" onClick={() => setSelectedId(request.id)}>
                                        {t("pages.payment_requests.action_details")}
                                    </Button>
                                    {live && mapped.canConfirm && canConfirmTransfer ? (
                                        <Button size="sm" variant="primary" onClick={() => setConfirmOpen(true)}>
                                            {t("pages.agent_workspace.deal.payments.confirm_transfer")}
                                        </Button>
                                    ) : null}
                                    {live && !isTerminalPaymentState(mapped.uiState) ? (
                                        <Button size="sm" loading={refreshing} onClick={() => void refreshStatus()}>
                                            <Icon name="refresh" size={12} />
                                            {t("pages.agent_workspace.deal.payments.refresh")}
                                        </Button>
                                    ) : null}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <DealPaymentCreateModal deal={deal} open={createOpen} onClose={() => setCreateOpen(false)} />
            <PaymentRequestDetailModal
                request={selected}
                sequence={selected ? sequence.get(selected.id) : null}
                sequenceTotal={ordered.length}
                open={selected != null && !cancelOpen && !confirmOpen}
                onClose={() => setSelectedId(null)}
                onCancel={
                    selected
                    && selected.id === paymentRequest?.id
                    && canCancelPaymentRequest(selected.ui_state)
                    && (canCreate || canConfirmTransfer)
                        ? () => setCancelOpen(true)
                        : undefined
                }
                onConfirm={
                    selected && selected.id === paymentRequest?.id && mapped.canConfirm && canConfirmTransfer
                        ? () => setConfirmOpen(true)
                        : undefined
                }
            />
            <ConfirmDialog
                open={confirmOpen}
                zIndex={1400}
                title={td("Confirm bank transfer?")}
                message={td("Confirm that the customer's bank transfer proof has been reviewed and approved.")}
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
        </SectionCard>
    );
}
