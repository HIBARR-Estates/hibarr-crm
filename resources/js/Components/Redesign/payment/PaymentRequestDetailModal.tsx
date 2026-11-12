import { type ReactNode } from "react";
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
import { REDESIGN_RADIUS, REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import {
    formatMoneyAmount,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import {
    hasActiveCheckoutLink,
    isCheckoutLinkExpired,
    isCollectedPaymentState,
} from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type {
    DealPaymentRequest,
    DealPaymentUiState,
    DealPaymentVerifiedBy,
} from "@/Types/api/deal-payment";

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

function IdentityCard({
    icon,
    role,
    name,
    href,
    detail,
}: {
    icon: "briefcase" | "user" | "users";
    role: string;
    name: string | null;
    href: string | null;
    detail?: string | null;
}) {
    const label = name?.trim() || DASH;
    const linked = Boolean(href && name?.trim());
    const body = (
        <span style={{ display: "block", minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: T.TEXT_MUTED }}>
                <Icon name={icon} size={14} />
                <span style={{ fontSize: REDESIGN_TYPE.CAPTION, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {role}
                </span>
            </span>
            <span
                style={{
                    display: "block",
                    marginTop: 6,
                    fontSize: REDESIGN_TYPE.BODY_LG,
                    fontWeight: 600,
                    color: linked ? T.NAVY : T.TEXT,
                    textDecoration: linked ? "underline" : "none",
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                }}
            >
                {label}
            </span>
            {detail ? (
                <span style={{ display: "block", marginTop: 2, fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED, lineHeight: 1.35 }}>
                    {detail}
                </span>
            ) : null}
        </span>
    );

    const frame = {
        display: "block",
        minWidth: 0,
        padding: "12px 14px",
        background: T.SURFACE_2,
        border: `1px solid ${T.BORDER}`,
        borderRadius: REDESIGN_RADIUS.MD,
        textDecoration: "none",
    };

    if (!linked || !href) {
        return <div style={frame}>{body}</div>;
    }

    return (
        <Link href={href} style={frame}>
            {body}
        </Link>
    );
}

const DASH = "—";

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: REDESIGN_RADIUS.LG,
                padding: "14px 16px",
            }}
        >
            <h3
                style={{
                    margin: "0 0 12px",
                    fontSize: REDESIGN_TYPE.CAPTION,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: T.TEXT_MUTED,
                }}
            >
                {title}
            </h3>
            {children}
        </section>
    );
}

function FactGrid({ columns, children }: { columns: number; children: ReactNode }) {
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: "12px 16px",
            }}
        >
            {children}
        </div>
    );
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
    return (
        <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
            <div style={{ fontSize: REDESIGN_TYPE.CAPTION, color: T.TEXT_MUTED, lineHeight: 1.3 }}>{label}</div>
            <div
                style={{
                    marginTop: 2,
                    fontSize: REDESIGN_TYPE.BODY,
                    fontWeight: 600,
                    color: T.TEXT,
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {children}
            </div>
        </div>
    );
}

function textOrDash(value: string | number | null | undefined): string {
    if (value == null) return DASH;
    const text = String(value).trim();
    return text === "" ? DASH : text;
}

/**
 * One payment request: the amount and who it is for, then the record grouped
 * into money, method, status, activity, and identifiers.
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
    const summary = linkExpired
        ? t("pages.deals.payment_request.retry_message")
        : request.ui_state === "invalidated" && request.invalidation_reason
            ? request.invalidation_reason
            : t(SUMMARY_KEY[request.ui_state]);

    const yesNo = (value: boolean) =>
        value ? t("pages.payment_requests.detail_fields.yes") : t("pages.payment_requests.detail_fields.no");
    const when = (value: string | null | undefined) => (value ? formatCompanyDateTime(value) : DASH);
    const field = (key: string) => t(`pages.payment_requests.detail_fields.${key}`);

    const gatewayLabel = !request.gateway
        ? t("pages.payment_requests.method_client_choice")
        : request.gateway === "manual-bank-transfer"
            ? t("pages.payment_requests.method_bank_transfer")
            : request.gateway === "nowpayments"
                ? t("pages.payment_requests.method_crypto")
                : td(request.gateway, { source: "en" });

    const typeLabel = (type: string | null) => {
        if (!type) return DASH;
        if (type === "manual") return t("pages.payment_requests.method_bank_transfer");
        if (type === "crypto") return t("pages.payment_requests.method_crypto");
        if (type === "fiat") return field("type_fiat");
        return td(type, { source: "en" });
    };

    const statusWord = (value: string | null, group: "ol" | "crm") => {
        if (!value) return DASH;
        const key = `pages.payment_requests.detail_fields.${group}_${value.toLowerCase()}`;
        const label = t(key);
        return label === key ? td(value, { source: "en" }) : label;
    };

    const person = (entry: DealPaymentVerifiedBy | null | undefined) => {
        if (!entry) return DASH;
        const href = safeRoute("employees.show", entry.id);
        const name = entry.name?.trim() || `#${entry.id}`;
        return (
            <span>
                {href ? (
                    <Link href={href} style={{ color: T.NAVY, fontWeight: 600, textDecoration: "underline" }}>
                        {name}
                    </Link>
                ) : (
                    name
                )}
                {entry.email ? (
                    <span style={{ display: "block", color: T.TEXT_MUTED }}>{entry.email}</span>
                ) : null}
            </span>
        );
    };

    return (
        <Modal
            open={open}
            title={t("pages.payment_requests.detail_title")}
            subtitle={subtitle}
            headerTone="sunken"
            onClose={onClose}
            closeOnBackdrop
            maxWidth={680}
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
                    {(onCancel || onConfirm || (onRetry && linkExpired)) && (
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            color: T.NAVY,
                            letterSpacing: "-0.02em",
                            lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {formatMoneyAmount(request.amount, requestCurrency)}
                    </div>
                    <div
                        style={{
                            marginTop: 8,
                            fontSize: REDESIGN_TYPE.BODY,
                            color: T.TEXT_MUTED,
                            fontVariantNumeric: "tabular-nums",
                        }}
                    >
                        {request.payment_id ? `#${request.payment_id}` : DASH}
                    </div>
                </div>
                <Badge variant={linkExpired ? "red" : paymentUiStateBadgeVariant(request.ui_state)}>
                    {linkExpired
                        ? t("pages.deals.payment_request.link_expired")
                        : td(paymentUiStateLabel(request.ui_state), { source: "en" })}
                </Badge>
            </div>

            <p style={{ margin: "12px 0 0", fontSize: REDESIGN_TYPE.BODY_LG, color: T.TEXT, lineHeight: 1.45 }}>
                {request.ui_state === "invalidated" && request.invalidation_reason
                    ? td(summary, { source: "en" })
                    : summary}
            </p>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                    marginTop: 16,
                }}
            >
                <IdentityCard
                    icon="briefcase"
                    role={t("pages.payment_requests.detail_deal")}
                    name={request.deal?.name ?? null}
                    href={request.deal?.url || null}
                    detail={
                        request.deal_value != null && companyCurrency
                            ? formatMoneyAmount(request.deal_value, companyCurrency)
                            : null
                    }
                />
                <IdentityCard
                    icon="user"
                    role={t("pages.payment_requests.detail_lead")}
                    name={leadName || null}
                    href={leadHref}
                />
                <IdentityCard
                    icon="users"
                    role={t("pages.payment_requests.detail_agent")}
                    name={request.agent_name ?? null}
                    href={agentHref}
                />
            </div>

            {activeLink && request.checkout_url && (
                <div style={{ marginTop: 12 }}>
                    <Panel title={field("checkout_url")}>
                        <a
                            href={request.checkout_url}
                            target="_blank"
                            rel="noreferrer"
                            title={request.checkout_url}
                            style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontSize: REDESIGN_TYPE.BODY,
                                fontWeight: 600,
                                color: T.NAVY,
                                lineHeight: 1.4,
                            }}
                        >
                            {request.checkout_url}
                        </a>
                        <div style={{ marginTop: 10 }}>
                            <CheckoutLinkActions url={request.checkout_url} size="base" />
                        </div>
                        {request.expires_at && (
                            <div style={{ marginTop: 8, fontSize: REDESIGN_TYPE.BODY, color: T.TEXT_MUTED }}>
                                {`${field("expires")} ${when(request.expires_at)}`}
                            </div>
                        )}
                    </Panel>
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                    marginTop: 12,
                }}
            >
                <Panel title={field("method")}>
                    <FactGrid columns={2}>
                        <Fact label={field("gateway")}>{gatewayLabel}</Fact>
                        <Fact label={field("payment_type")}>{typeLabel(request.ol_payment_type)}</Fact>
                        <Fact label={field("transaction_id")} wide>{textOrDash(request.transaction_id)}</Fact>
                        <Fact label={field("ol_status")}>{statusWord(request.ol_status, "ol")}</Fact>
                        <Fact label={field("crm_status")}>{statusWord(request.crm_status, "crm")}</Fact>
                        <Fact label={field("can_confirm")}>{yesNo(request.can_confirm)}</Fact>
                    </FactGrid>
                </Panel>
                <Panel title={field("money")}>
                    <FactGrid columns={2}>
                        <Fact label={field("currency")}>{textOrDash(request.currency)}</Fact>
                        <Fact label={field("exchange_rate")}>{textOrDash(request.exchange_rate)}</Fact>
                        <Fact label={field("base_amount")} wide>
                            {request.base_amount != null
                                ? formatMoneyAmount(request.base_amount, {
                                      code: request.base_currency ?? "",
                                      symbol: request.base_currency_symbol || request.base_currency || "",
                                  })
                                : DASH}
                        </Fact>
                        <Fact label={field("rate")} wide>
                            {converted
                                ? `1 ${request.base_currency} = ${request.rate} ${request.currency}`
                                : textOrDash(request.rate)}
                        </Fact>
                    </FactGrid>
                </Panel>
            </div>

            <div style={{ marginTop: 12 }}>
                <Panel title={field("activity")}>
                    <FactGrid columns={2}>
                        <Fact label={t("pages.payment_requests.detail_created")}>
                            {when(request.created_at)}
                            {request.added_by ? (
                                <span style={{ display: "block", marginTop: 2, fontWeight: 500 }}>{person(request.added_by)}</span>
                            ) : null}
                        </Fact>
                        <Fact label={field("updated")}>
                            {when(request.updated_at)}
                            {request.last_updated_by ? (
                                <span style={{ display: "block", marginTop: 2, fontWeight: 500 }}>{person(request.last_updated_by)}</span>
                            ) : null}
                        </Fact>
                        <Fact label={field("paid_on")}>{when(request.paid_on)}</Fact>
                        <Fact label={field("confirmed_by")}>
                            {when(request.verified_at)}
                            {request.verified_by ? (
                                <span style={{ display: "block", marginTop: 2, fontWeight: 500 }}>{person(request.verified_by)}</span>
                            ) : null}
                        </Fact>
                        {request.ui_state === "invalidated" && (
                            <>
                                <Fact label={field("cancelled_at")}>
                                    {when(request.invalidated_at)}
                                    {request.invalidated_by ? (
                                        <span style={{ display: "block", marginTop: 2, fontWeight: 500 }}>{person(request.invalidated_by)}</span>
                                    ) : null}
                                </Fact>
                                <Fact label={field("reason")}>
                                    {request.invalidation_reason ? td(request.invalidation_reason, { source: "en" }) : DASH}
                                </Fact>
                            </>
                        )}
                        {request.remarks ? (
                            <Fact label={field("remarks")} wide>{td(request.remarks, { source: "en" })}</Fact>
                        ) : null}
                    </FactGrid>
                </Panel>
            </div>

            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "4px 16px",
                    marginTop: 14,
                    fontSize: REDESIGN_TYPE.CAPTION,
                    color: T.TEXT_HINT,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                <span>{`${field("payment_row_id")} ${request.id}`}</span>
                <span>{`${field("deal_id")} ${textOrDash(request.deal_id)}`}</span>
                <span>{`${field("reference")} ${request.payment_id ? `#${request.payment_id}` : DASH}`}</span>
            </div>
        </Modal>
    );
}
