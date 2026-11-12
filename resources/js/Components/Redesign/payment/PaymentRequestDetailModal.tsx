import { Link } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import {
    formatMoneyAmount,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import {
    hasActiveCheckoutLink,
    isCheckoutLinkExpired,
    isCollectedPaymentState,
    isTerminalPaymentState,
} from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { DealPaymentRequest, DealPaymentUiState } from "@/Types/api/deal-payment";

export interface PaymentRequestDetail extends DealPaymentRequest {
    deal?: { id: number; name: string | null; url: string } | null;
    deal_value?: number | null;
    agent_name?: string | null;
    agent_user_id?: number | null;
    lead_id?: number | null;
    lead_name?: string | null;
    lead_company?: string | null;
}

interface PaymentRequestDetailModalProps {
    request: PaymentRequestDetail | null;
    /** 1-based position in the order the requests were created. */
    sequence?: number | null;
    sequenceTotal?: number | null;
    open: boolean;
    onClose: () => void;
    /** Present when the viewer may cancel this still-pending request. */
    onCancel?: () => void;
    /** Present when the viewer may confirm this bank transfer. */
    onConfirm?: () => void;
    /** Present when this request's checkout link has expired and can be replaced. */
    onRetry?: () => void;
    companyCurrency?: CurrencyDisplay | null;
}

const SUMMARY_KEY: Record<DealPaymentUiState, string> = {
    pending_payment: "pages.payment_requests.detail_summary.pending_payment",
    bank_transfer_pending: "pages.payment_requests.detail_summary.bank_transfer_pending",
    processing_online: "pages.payment_requests.detail_summary.processing_online",
    paid_online: "pages.payment_requests.detail_summary.paid_online",
    confirmed: "pages.payment_requests.detail_summary.confirmed",
    failed: "pages.payment_requests.detail_summary.failed",
    invalidated: "pages.payment_requests.detail_summary.invalidated",
};

function documentHref(request: DealPaymentRequest, kind: "invoice" | "receipt"): string | null {
    if (request.deal_id == null) return null;
    try {
        return route("deals.payment-requests.document", {
            deal: request.deal_id,
            payment: request.id,
            kind,
        });
    } catch {
        return null;
    }
}

function safeRoute(name: string, param: string | number): string | null {
    try {
        return route(name, param);
    } catch {
        return null;
    }
}

function DocumentLink({ href, label, external = false }: { href: string; label: string; external?: boolean }) {
    return (
        <a
            className="dr-btn dr-btn-ghost"
            href={href}
            {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
            style={{ textDecoration: "none" }}
        >
            <Icon name={external ? "file-text" : "download"} size={14} />
            {label}
        </a>
    );
}

function PartyLink({
    icon,
    role,
    name,
    href,
    detail,
}: {
    icon: "briefcase" | "user" | "users";
    role: string;
    name: string;
    href: string | null;
    detail?: string | null;
}) {
    const body = (
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Icon name={icon} size={16} color={T.TEXT_MUTED} />
            <span style={{ flex: "0 0 auto", fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED }}>
                {role}
            </span>
            <span style={{ minWidth: 0 }}>
                <span
                    style={{
                        display: "block",
                        fontSize: REDESIGN_TYPE.BODY_LG,
                        fontWeight: 600,
                        color: href ? T.NAVY : T.TEXT,
                        textDecoration: href ? "underline" : "none",
                        lineHeight: 1.35,
                        overflowWrap: "anywhere",
                    }}
                >
                    {name}
                </span>
                {detail && (
                    <span
                        style={{
                            display: "block",
                            marginTop: 2,
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            lineHeight: 1.35,
                        }}
                    >
                        {detail}
                    </span>
                )}
            </span>
        </span>
    );

    if (!href) {
        return <div style={{ padding: "8px 0" }}>{body}</div>;
    }

    return (
        <Link href={href} style={{ display: "block", padding: "8px 0", textDecoration: "none" }}>
            {body}
        </Link>
    );
}

/**
 * One payment request, read as a short story: what is owed, what state it
 * is in, who it is for, and the one action that state still allows.
 * Shared by the deal page and the payment-requests list.
 */
export default function PaymentRequestDetailModal({
    request,
    sequence,
    sequenceTotal,
    open,
    onClose,
    onCancel,
    onConfirm,
    onRetry,
    companyCurrency,
}: PaymentRequestDetailModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    if (!request) return null;

    const requestCurrency: CurrencyDisplay = {
        code: request.currency ?? "",
        symbol: request.currency_symbol || request.currency || "",
    };
    const collected = isCollectedPaymentState(request.ui_state);
    const converted =
        request.rate !== null
        && request.base_currency
        && request.base_currency !== request.currency
        && request.base_amount !== null;
    const subtitle =
        sequence && sequenceTotal
            ? t("pages.deals.payment_request.request_number", {
                  number: sequence,
                  total: sequenceTotal,
              })
            : undefined;
    const leadName = [request.lead_name, request.lead_company].filter(Boolean).join(" · ");
    const leadHref = request.lead_id ? safeRoute("lead-contact.show", request.lead_id) : null;
    const agentHref = request.agent_user_id ? safeRoute("employees.show", request.agent_user_id) : null;
    const invoiceUrl = documentHref(request, "invoice");
    const receiptUrl = collected ? documentHref(request, "receipt") : null;
    const linkExpired = isCheckoutLinkExpired(request);
    const activeLink = hasActiveCheckoutLink(request);
    const showCheckout = activeLink && Boolean(request.checkout_url);
    const showExpires = Boolean(request.expires_at) && !isTerminalPaymentState(request.ui_state);
    const summary = linkExpired
        ? t("pages.deals.payment_request.retry_message")
        : request.ui_state === "invalidated" && request.invalidation_reason
            ? request.invalidation_reason
            : t(SUMMARY_KEY[request.ui_state]);

    return (
        <Modal
            open={open}
            title={t("pages.payment_requests.detail_title")}
            subtitle={subtitle}
            headerTone="sunken"
            onClose={onClose}
            closeOnBackdrop
            footer={
                <div className="flex w-full flex-wrap items-center gap-2">
                    {invoiceUrl && (
                        <DocumentLink href={invoiceUrl} label={t("pages.payment_requests.action_invoice")} />
                    )}
                    {receiptUrl && (
                        <DocumentLink href={receiptUrl} label={t("pages.payment_requests.action_receipt")} />
                    )}
                    {request.proof_url && (
                        <DocumentLink
                            href={request.proof_url}
                            label={t("pages.payment_requests.detail_proof")}
                            external
                        />
                    )}
                    {(onCancel || onConfirm) && (
                        <div className="ml-auto flex items-center gap-2">
                            {onCancel && (
                                <Button variant="ghost" style={{ color: T.RED }} onClick={onCancel}>
                                    {t("pages.deals.payment_request.cancel_action")}
                                </Button>
                            )}
                            {onConfirm && (
                                <Button variant="primary" onClick={onConfirm}>
                                    {t("pages.payment_requests.action_confirm")}
                                </Button>
                            )}
                            {onRetry && linkExpired && (
                                <Button variant="primary" onClick={onRetry}>
                                    {t("pages.deals.payment_request.retry_action")}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            }
        >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div
                    style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: T.NAVY,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {formatMoneyAmount(request.amount, requestCurrency)}
                </div>
                <Badge variant={linkExpired ? "red" : paymentUiStateBadgeVariant(request.ui_state)}>
                    {linkExpired
                        ? t("pages.deals.payment_request.link_expired")
                        : td(paymentUiStateLabel(request.ui_state), { source: "en" })}
                </Badge>
            </div>

            {converted && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.4,
                    }}
                >
                    {`≈ ${formatMoneyAmount(request.base_amount as number, {
                        code: request.base_currency ?? "",
                        symbol: request.base_currency_symbol || request.base_currency || "",
                    })} · 1 ${request.base_currency} = ${request.rate} ${request.currency}`}
                </div>
            )}
            {request.payment_id && (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.4,
                    }}
                >
                    {`#${request.payment_id}`}
                </div>
            )}

            <p style={{ margin: "14px 0 0", fontSize: REDESIGN_TYPE.BODY_LG, color: T.TEXT, lineHeight: 1.45 }}>
                {request.ui_state === "invalidated" && request.invalidation_reason
                    ? td(summary, { source: "en" })
                    : summary}
            </p>

            {(request.deal?.name || leadName || request.agent_name) && (
                <div style={{ marginTop: 8 }}>
                    {request.deal?.name && (
                        <PartyLink
                            icon="briefcase"
                            role={t("pages.payment_requests.detail_deal")}
                            name={request.deal.name}
                            href={request.deal.url || null}
                            detail={
                                request.deal_value != null && companyCurrency
                                    ? formatMoneyAmount(request.deal_value, companyCurrency)
                                    : null
                            }
                        />
                    )}
                    {leadName && (
                        <PartyLink
                            icon="user"
                            role={t("pages.payment_requests.detail_lead")}
                            name={leadName}
                            href={leadHref}
                        />
                    )}
                    {request.agent_name && (
                        <PartyLink
                            icon="users"
                            role={t("pages.payment_requests.detail_agent")}
                            name={request.agent_name}
                            href={agentHref}
                        />
                    )}
                </div>
            )}

            {(request.created_at || showExpires || request.verified_by || request.invalidated_at) && (
                <div
                    style={{
                        marginTop: 12,
                        fontSize: REDESIGN_TYPE.BODY,
                        color: T.TEXT_MUTED,
                        lineHeight: 1.5,
                    }}
                >
                    {request.created_at && <div>{formatCompanyDateTime(request.created_at)}</div>}
                    {showExpires && request.expires_at && (
                        <div>
                            {`${t("pages.payment_requests.detail_expires")} ${formatCompanyDateTime(request.expires_at)}`}
                        </div>
                    )}
                    {request.verified_by && (
                        <div>
                            {request.verified_by.name}
                            {request.verified_at ? ` · ${formatCompanyDateTime(request.verified_at)}` : ""}
                        </div>
                    )}
                    {request.invalidated_at && <div>{formatCompanyDateTime(request.invalidated_at)}</div>}
                </div>
            )}

            {showCheckout && request.checkout_url && (
                <div
                    style={{
                        marginTop: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                    }}
                >
                    <span style={{ fontSize: REDESIGN_TYPE.BODY_LG, color: T.TEXT }}>
                        {t("pages.deals.payment_request.checkout_link")}
                    </span>
                    <CheckoutLinkActions url={request.checkout_url} size="base" />
                </div>
            )}
        </Modal>
    );
}
