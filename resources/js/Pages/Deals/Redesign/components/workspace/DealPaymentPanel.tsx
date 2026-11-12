import { useMemo, useState } from "react";
import type { Deal } from "@/Types/api/deals";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealPayment from "../../hooks/useDealPayment";
import {
    canCancelPaymentRequest,
    coveredBaseAmount,
    hasActiveCheckoutLink,
    isCheckoutLinkExpired,
    isTerminalPaymentState,
    remainingDealBalance,
} from "../../adapters/mapDealPaymentUiState";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import {
    formatMoneyAmount,
    useCompanyCurrency,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { REDESIGN_RADIUS, REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import SectionLabel from "@/Components/Redesign/primitives/SectionLabel";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import PaymentRequestDetailModal, {
    type PaymentRequestDetail,
} from "@/Components/Redesign/payment/PaymentRequestDetailModal";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";
import DealPaymentCreateModal from "./DealPaymentCreateModal";

interface DealPaymentPanelProps {
    deal: Deal;
    canCreatePaymentRequest: boolean;
    canConfirmPaymentTransfer: boolean;
}

function detailFromDeal(request: DealPaymentRequest, deal: Deal): PaymentRequestDetail {
    const agent = deal.lead_agent ?? deal.agent;
    let dealUrl = "";
    try {
        dealUrl = route("deals.show", deal.id);
    } catch {
        dealUrl = "";
    }

    return {
        ...request,
        deal: {
            id: deal.id,
            name: deal.name,
            url: dealUrl,
        },
        deal_value: deal.value != null ? Number(deal.value) : null,
        lead_id: deal.contact?.id ?? deal.lead_id ?? null,
        lead_name: deal.contact?.client_name ?? null,
        lead_company: deal.contact?.company_name ?? null,
        agent_name: agent?.user?.name ?? agent?.name ?? null,
        agent_user_id: agent?.user?.id ?? agent?.user_id ?? null,
    };
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
        retryRequest,
        refreshStatus,
        confirming,
        cancelling,
        retrying,
        refreshing,
    } = useDealPayment(deal.id);

    const [createOpen, setCreateOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [retryTarget, setRetryTarget] = useState<DealPaymentRequest | null>(null);
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
    const canReplace = canCreatePaymentRequest || canConfirmPaymentTransfer;
    const newestExpired = newestFirst.find((request) => isCheckoutLinkExpired(request));
    const canRetry = (request: DealPaymentRequest) =>
        canReplace
        && newestExpired?.id === request.id
        && (paymentRequest == null || paymentRequest.id === request.id);
    const selectedIsActive = selected != null && selected.id === paymentRequest?.id;
    const cashPending = paymentRequest?.ui_state === "cash_pending";
    const companyFallback = useCompanyCurrency();
    const breakdownCurrency = deal.value_breakdown?.currency;
    const companyCurrency = {
        code: breakdownCurrency?.company_code || companyFallback.code,
        symbol:
            breakdownCurrency?.company_symbol ||
            companyFallback.symbol ||
            companyFallback.code,
    };
    const paid = coveredBaseAmount(paymentRequests);
    const remaining = remainingDealBalance(Number(deal.value ?? 0), paymentRequests);
    const hasOpenRequest = paymentRequest != null && !isTerminalPaymentState(paymentRequest.ui_state);
    const canRequestMore = canCreatePaymentRequest && !paymentRequestLoading && remaining > 0 && !hasOpenRequest;
    const showRefresh = paymentRequest != null && !isTerminalPaymentState(paymentRequest.ui_state) && !cashPending;

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
                    {canRequestMore && (
                        <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                            {paymentRequest
                                ? t("pages.deals.payment_request.request_another")
                                : td("Create Payment Request")}
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {(
                    [
                        [t("pages.deals.payment_request.paid_total"), paid],
                        [t("pages.deals.payment_request.balance_remaining"), remaining],
                    ] as const
                ).map(([label, amount]) => (
                    <div
                        key={label}
                        style={{
                            padding: "10px 12px",
                            background: T.SURFACE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: REDESIGN_RADIUS.MD,
                        }}
                    >
                        <div
                            style={{
                                fontSize: REDESIGN_TYPE.CAPTION,
                                fontWeight: 600,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                color: T.TEXT_HINT,
                            }}
                        >
                            {label}
                        </div>
                        <div
                            className="tabular-nums"
                            style={{
                                marginTop: 2,
                                fontSize: REDESIGN_TYPE.DISPLAY,
                                fontWeight: 700,
                                color: T.TEXT,
                                lineHeight: 1.2,
                            }}
                        >
                            {formatMoneyAmount(amount, companyCurrency)}
                        </div>
                    </div>
                ))}
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
                            const expired = isCheckoutLinkExpired(request);
                            const activeLink = hasActiveCheckoutLink(request);
                            return (
                                <li key={request.id}>
                                    <div
                                        className="flex w-full items-center gap-2.5"
                                        style={{
                                            padding: "10px 12px",
                                            background: T.SURFACE,
                                            border: `1px solid ${active ? T.BLUE : T.BORDER}`,
                                            borderRadius: REDESIGN_RADIUS.MD,
                                            boxShadow: active ? `inset 3px 0 0 ${T.BLUE}` : undefined,
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(request.id)}
                                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                                            style={{ fontFamily: "inherit", background: "transparent", border: 0, padding: 0 }}
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
                                        <Badge variant={expired ? "red" : paymentUiStateBadgeVariant(request.ui_state)}>
                                            {expired
                                                ? t("pages.deals.payment_request.link_expired")
                                                : td(paymentUiStateLabel(request.ui_state))}
                                        </Badge>
                                        </button>
                                        {(activeLink || canRetry(request)) && (
                                            <span className="flex shrink-0 items-center gap-1">
                                                {activeLink && request.checkout_url && (
                                                    <CheckoutLinkActions url={request.checkout_url} compact size="sm" />
                                                )}
                                                {canRetry(request) && (
                                                    <Button size="sm" variant="primary" onClick={() => setRetryTarget(request)}>
                                                        {t("pages.deals.payment_request.retry_action")}
                                                    </Button>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </>
            )}

            <PaymentRequestDetailModal
                request={selected ? detailFromDeal(selected, deal) : null}
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
                onRetry={selected && canRetry(selected) ? () => setRetryTarget(selected) : undefined}
            />

            <DealPaymentCreateModal
                deal={deal}
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />

            <ConfirmDialog
                open={confirmOpen}
                zIndex={1400}
                title={
                    cashPending
                        ? t("pages.deals.payment_request.confirm_cash_title")
                        : td("Confirm bank transfer?")
                }
                message={
                    cashPending
                        ? t("pages.deals.payment_request.confirm_cash_message")
                        : td("Confirm that the customer's bank transfer proof has been reviewed and approved. The deal is marked as won only when confirmed payments add up to the deal value.")
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

            <ConfirmDialog
                open={retryTarget != null}
                zIndex={1400}
                title={t("pages.deals.payment_request.retry_title")}
                message={t("pages.deals.payment_request.retry_message")}
                confirmLabel={t("pages.deals.payment_request.retry_confirm")}
                cancelLabel={t("pages.deals.payment_request.cancel")}
                confirmLoading={retrying}
                onConfirm={() => {
                    if (!retryTarget) return;
                    void retryRequest(retryTarget.id).then((result) => {
                        if (result.ok) {
                            setRetryTarget(null);
                            setSelectedId(null);
                        }
                    });
                }}
                onCancel={() => setRetryTarget(null)}
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
