import { useState } from "react";
import { paymentUiStateBadgeVariant, paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import Button from "@/Components/Redesign/primitives/Button";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import {
    isTerminalPaymentState,
    mapDealPaymentUiState,
    remainingDealBalance,
} from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
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
 * The deal's payment requests: the live one with its status, checkout link
 * and, for an admin, Confirm transfer; earlier ones struck through below.
 * Request opens the same create dialog as the deal page.
 */
export default function PaymentsSection({ deal, canCreate, canConfirmTransfer }: PaymentsSectionProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const { paymentRequest, paymentRequests, paymentRequestLoading, confirmTransfer, refreshStatus, confirming, refreshing } =
        useDealPayment(deal.id);
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const mapped = mapDealPaymentUiState(paymentRequest);
    const history = paymentRequests.filter((request) => request.id !== paymentRequest?.id);
    const remaining = remainingDealBalance(Number(deal.value ?? 0), paymentRequests);
    const hasOpenRequest = paymentRequest !== null && !isTerminalPaymentState(mapped.uiState);
    const canRequestMore = canCreate && !paymentRequestLoading && remaining > 0 && !hasOpenRequest;
    const cashPending = mapped.uiState === "cash_pending";
    const stamp = (request: DealPaymentRequest) =>
        request.ui_state === "confirmed" && request.verified_at
            ? t("pages.agent_workspace.deal.payments.confirmed_on", { date: formatDateTime(request.verified_at) })
            : formatDateTime(request.updated_at ?? request.created_at);

    return (
        <SectionCard
            id="deal-payments"
            title={t("pages.agent_workspace.deal.payments.title")}
            action={
                canRequestMore ? (
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
                    {paymentRequest ? (
                        <li className="agent-deal__row agent-deal__row--payment">
                            <span className="agent-deal__row-top">
                                <span className="agent-deal__row-body">
                                    <span className="agent-deal__row-title">{requestMoney(paymentRequest)}</span>
                                    <span className="agent-deal__row-sub">{stamp(paymentRequest)}</span>
                                </span>
                                <span className={`agent-deal__status agent-deal__status--${paymentUiStateBadgeVariant(paymentRequest.ui_state)}`}>
                                    {td(paymentUiStateLabel(paymentRequest.ui_state))}
                                </span>
                            </span>
                            {mapped.showCheckoutUrl && paymentRequest.checkout_url ? (
                                <CheckoutLinkActions url={paymentRequest.checkout_url} />
                            ) : null}
                            {paymentRequest.proof_url ? (
                                <a className="agent-deal__link" href={paymentRequest.proof_url} target="_blank" rel="noreferrer">
                                    <Icon name="file-text" size={12} />
                                    {t("pages.agent_workspace.deal.payments.proof")}
                                </a>
                            ) : null}
                            <span className="agent-deal__row-actions">
                                {mapped.canConfirm && canConfirmTransfer ? (
                                    <Button size="sm" variant="primary" onClick={() => setConfirmOpen(true)}>
                                        {cashPending
                                            ? t("pages.agent_workspace.deal.payments.confirm_cash")
                                            : t("pages.agent_workspace.deal.payments.confirm_transfer")}
                                    </Button>
                                ) : null}
                                {!isTerminalPaymentState(mapped.uiState) && !cashPending ? (
                                    <Button size="sm" loading={refreshing} onClick={() => void refreshStatus()}>
                                        <Icon name="refresh" size={12} />
                                        {t("pages.agent_workspace.deal.payments.refresh")}
                                    </Button>
                                ) : null}
                            </span>
                        </li>
                    ) : null}
                    {history.map((request) => {
                        const struck = request.ui_state === "failed" || request.ui_state === "invalidated";
                        return (
                        <li
                            key={request.id}
                            className={`agent-deal__row agent-deal__row--payment agent-deal__row--past${struck ? " agent-deal__row--struck" : ""}`}
                        >
                            <span className="agent-deal__row-top">
                                <span className="agent-deal__row-body">
                                    <span className="agent-deal__row-title">{requestMoney(request)}</span>
                                    <span className="agent-deal__row-sub">{stamp(request)}</span>
                                </span>
                                <span className={`agent-deal__status agent-deal__status--${paymentUiStateBadgeVariant(request.ui_state)}`}>
                                    {td(paymentUiStateLabel(request.ui_state))}
                                </span>
                            </span>
                        </li>
                        );
                    })}
                </ul>
            )}
            <DealPaymentCreateModal deal={deal} open={createOpen} onClose={() => setCreateOpen(false)} />
            <ConfirmDialog
                open={confirmOpen}
                title={
                    cashPending
                        ? t("pages.agent_workspace.deal.payments.confirm_cash_title")
                        : td("Confirm bank transfer?")
                }
                message={
                    cashPending
                        ? t("pages.agent_workspace.deal.payments.confirm_cash_message")
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
        </SectionCard>
    );
}
