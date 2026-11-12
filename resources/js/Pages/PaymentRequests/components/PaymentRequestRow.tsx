import { Link } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import CheckoutLinkActions from "@/Components/Redesign/primitives/CheckoutLinkActions";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import {
    hasActiveCheckoutLink,
    isCheckoutLinkExpired,
} from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import { formatMoneyAmount, type CurrencyDisplay } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";

export interface PaymentRequestListRow extends DealPaymentRequest {
    deal: { id: number; name: string | null; url: string } | null;
    /** The deal's value now, in company currency. */
    deal_value: number | null;
    agent_name: string | null;
    agent_user_id: number | null;
    lead_id: number | null;
    lead_name: string | null;
    lead_company: string | null;
}

/**
 * Columns that stay on the row. When the request was created still lives
 * in the modal. Deal value sits under the deal name, and a foreign-currency
 * rate sits under the amount, so neither needs its own column.
 */
/**
 * One track list for the header and every row, shared by a single parent
 * grid. Status is max-content so a badge stays on one line, and the last
 * track is the invoice / confirm actions (16px of end padding lives in it).
 */
export const PAYMENT_REQUEST_GRID =
    "minmax(0, 1.5fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.9fr) max-content 336px";

interface PaymentRequestRowProps {
    row: PaymentRequestListRow;
    companyCurrency: CurrencyDisplay;
    onConfirm: () => void;
    onOpen: () => void;
    onRetry: () => void;
}

function invoiceHref(row: PaymentRequestListRow): string | null {
    if (row.deal_id == null) return null;
    try {
        return route("deals.payment-requests.document", {
            deal: row.deal_id,
            payment: row.id,
            kind: "invoice",
        });
    } catch {
        return null;
    }
}

function leadHref(leadId: number): string | null {
    try {
        return route("lead-contact.show", leadId);
    } catch {
        return null;
    }
}

const nameLinkClass = "text-sm text-dr-text no-underline hover:text-dr-blue";

/**
 * One payment request. The row opens the request; the deal and lead names
 * go to those records. Row actions are the invoice, confirm, a live checkout's share and copy, and retry when the link has expired.
 */
export default function PaymentRequestRow({
    row,
    companyCurrency,
    onConfirm,
    onOpen,
    onRetry,
}: PaymentRequestRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const inactive = row.ui_state === "invalidated" || row.ui_state === "failed";
    const requestCurrency: CurrencyDisplay = {
        code: row.currency ?? "",
        symbol: row.currency_symbol || row.currency || "",
    };
    const leadLabel = [row.lead_name, row.lead_company].filter(Boolean).join(" · ");
    const leadUrl = row.lead_id && leadLabel ? leadHref(row.lead_id) : null;
    const invoiceUrl = invoiceHref(row);
    const linkExpired = isCheckoutLinkExpired(row);
    const activeLink = hasActiveCheckoutLink(row);
    const foreignCurrency = Boolean(
        row.rate != null && row.base_currency && row.currency && row.base_currency !== row.currency,
    );
    return (
        <div
            className="cursor-pointer items-center py-3.5 hover:bg-dr-surface-hover"
            style={{
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
                alignItems: "center",
                minHeight: 72,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
            onClick={onOpen}
        >
            <div style={{ minWidth: 0, paddingLeft: 16 }}>
                {row.deal ? (
                    <Link
                        href={row.deal.url}
                        className={`${nameLinkClass} font-semibold`}
                        style={{ overflowWrap: "break-word", lineHeight: 1.4 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {row.deal.name}
                    </Link>
                ) : (
                    <span className="text-sm text-dr-text-hint">—</span>
                )}
                {row.deal_value != null && (
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: REDESIGN_TYPE.CAPTION,
                            color: T.TEXT_MUTED,
                            fontVariantNumeric: "tabular-nums",
                            overflowWrap: "break-word",
                            lineHeight: 1.4,
                        }}
                    >
                        {`${t("pages.payment_requests.col_deal_value")} · ${formatMoneyAmount(row.deal_value, companyCurrency)}`}
                    </div>
                )}
            </div>

            <div style={{ minWidth: 0 }}>
                {leadUrl ? (
                    <Link
                        href={leadUrl}
                        className={`${nameLinkClass} font-medium`}
                        style={{ overflowWrap: "break-word", lineHeight: 1.4 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        {leadLabel}
                    </Link>
                ) : (
                    <span className="text-sm text-dr-text-hint">—</span>
                )}
            </div>

            <div
                style={{
                    minWidth: 0,
                    fontSize: REDESIGN_TYPE.BODY,
                    color: row.agent_name ? T.TEXT : T.TEXT_HINT,
                    overflowWrap: "break-word",
                    lineHeight: 1.4,
                }}
            >
                {row.agent_name || "—"}
            </div>

            <div style={{ minWidth: 0 }}>
                <div
                    className="font-semibold"
                    style={{
                        fontSize: REDESIGN_TYPE.BODY,
                        color: inactive ? T.TEXT_HINT : T.TEXT,
                        textDecoration: row.ui_state === "invalidated" ? "line-through" : undefined,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {formatMoneyAmount(row.amount, requestCurrency)}
                </div>
                {foreignCurrency && (
                    <div
                        style={{
                            marginTop: 2,
                            fontSize: REDESIGN_TYPE.CAPTION,
                            color: T.TEXT_MUTED,
                            fontVariantNumeric: "tabular-nums",
                            overflowWrap: "break-word",
                            lineHeight: 1.4,
                        }}
                    >
                        {`1 ${row.base_currency} = ${row.rate} ${row.currency}`}
                    </div>
                )}
            </div>

            <div style={{ width: "max-content", maxWidth: "100%" }}>
                <Badge
                    variant={linkExpired ? "red" : paymentUiStateBadgeVariant(row.ui_state)}
                >
                    {linkExpired
                        ? t("pages.deals.payment_request.link_expired")
                        : td(paymentUiStateLabel(row.ui_state), { source: "en" })}
                </Badge>
                {row.payment_id && (
                    <div
                        style={{
                            contain: "inline-size",
                            width: "100%",
                            marginTop: 6,
                            fontSize: REDESIGN_TYPE.CAPTION,
                            color: T.TEXT_MUTED,
                            fontVariantNumeric: "tabular-nums",
                            overflowWrap: "anywhere",
                            lineHeight: 1.4,
                        }}
                    >
                        {`#${row.payment_id}`}
                    </div>
                )}
            </div>

            <div
                className="flex shrink-0 items-center justify-end gap-2"
                style={{ paddingRight: 16 }}
                onClick={(event) => event.stopPropagation()}
            >
                {invoiceUrl ? (
                    <a
                        className="dr-btn dr-btn-ghost dr-btn-sm"
                        href={invoiceUrl}
                        style={{ textDecoration: "none" }}
                    >
                        <Icon name="download" size={14} />
                        {t("pages.payment_requests.action_invoice")}
                    </a>
                ) : (
                    <Button variant="ghost" size="sm" disabled icon={<Icon name="download" size={14} />}>
                        {t("pages.payment_requests.action_invoice")}
                    </Button>
                )}
                {activeLink && row.checkout_url && (
                    <CheckoutLinkActions url={row.checkout_url} compact size="sm" />
                )}
                {linkExpired && (
                    <Button variant="primary" size="sm" onClick={onRetry}>
                        {t("pages.deals.payment_request.retry_action")}
                    </Button>
                )}
                {row.can_confirm && (
                    <Button variant="primary" size="sm" onClick={onConfirm}>
                        {row.ui_state === "cash_pending"
                            ? t("pages.payment_requests.action_confirm_cash")
                            : t("pages.payment_requests.action_confirm")}
                    </Button>
                )}
            </div>
        </div>
    );
}
