import { Link } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Badge from "@/Components/Redesign/primitives/Badge";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    paymentUiStateBadgeVariant,
    paymentUiStateLabel,
} from "@/Components/Redesign/adapters/dealPaymentUiState";
import {
    formatMoneyAmount,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";

export interface PaymentRequestListRow extends DealPaymentRequest {
    deal: { id: number; name: string | null; url: string } | null;
    /** The deal's value now, in company currency. */
    deal_value: number | null;
    agent_name: string | null;
}

/**
 * Column widths, shared with the list's header row so the two line up — and
 * the responsive classes with them, so a column that drops out at a
 * breakpoint drops out of the header at the same one.
 */
export const PAYMENT_REQUEST_COLUMNS = {
    dealValue: { width: 140, className: "hidden md:block" },
    requested: { width: 170, className: "" },
    status: { width: 190, className: "hidden sm:block" },
    method: { width: 120, className: "hidden lg:block" },
    created: { width: 140, className: "hidden xl:block" },
    actions: { width: 240, className: "" },
} as const;

const C = PAYMENT_REQUEST_COLUMNS;

interface PaymentRequestRowProps {
    row: PaymentRequestListRow;
    companyCurrency: CurrencyDisplay;
    onConfirm: () => void;
}

/** When the row's current status was reached, for the line under the badge. */
function statusTimestamp(row: PaymentRequestListRow): string | null {
    const at =
        row.ui_state === "confirmed"
            ? row.verified_at
            : row.ui_state === "invalidated"
              ? row.invalidated_at
              : row.updated_at;
    return at ? formatCompanyDateTime(at) : null;
}

/**
 * One payment request as a list row.
 *
 * The two money columns answer different questions: what the deal is worth
 * (company currency, today) and what the client was asked to pay (in the
 * currency the request was issued in, with the rate it was converted at).
 * They only disagree for requests in another currency — or once the deal's
 * value has moved on, which is exactly when a request gets invalidated.
 */
export default function PaymentRequestRow({
    row,
    companyCurrency,
    onConfirm,
}: PaymentRequestRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const inactive = row.ui_state === "invalidated" || row.ui_state === "failed";
    const requestCurrency: CurrencyDisplay = {
        code: row.currency ?? "",
        symbol: row.currency_symbol || row.currency || "",
    };
    const converted =
        row.rate !== null && row.base_currency && row.base_currency !== row.currency;
    const timestamp = statusTimestamp(row);

    const methodLabel =
        row.gateway === "manual-bank-transfer"
            ? t("pages.payment_requests.method_bank_transfer")
            : row.gateway === "nowpayments"
              ? t("pages.payment_requests.method_crypto")
              : t("pages.payment_requests.method_client_choice");

    return (
        <div
            className="flex items-center gap-4 px-4 py-2.5"
            style={{
                minHeight: 64,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            {/* The deal leads — that's what a finance reviewer is scanning for. */}
            <div className="min-w-0 flex-1">
                {row.deal ? (
                    <Link
                        href={row.deal.url}
                        className="block truncate font-semibold no-underline"
                        style={{ fontSize: 13, color: T.TEXT }}
                    >
                        {row.deal.name}
                    </Link>
                ) : (
                    <span style={{ fontSize: 13, color: T.TEXT_HINT }}>—</span>
                )}
                <div className="truncate" style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {row.agent_name ?? "—"}
                </div>
            </div>

            <div
                className={`shrink-0 ${C.dealValue.className}`}
                style={{
                    width: C.dealValue.width,
                    fontSize: 13,
                    color: T.TEXT_MUTED,
                    fontVariantNumeric: "tabular-nums",
                }}
            >
                {row.deal_value !== null
                    ? formatMoneyAmount(row.deal_value, companyCurrency)
                    : "—"}
            </div>

            <div
                className={`shrink-0 ${C.requested.className}`}
                style={{ width: C.requested.width }}
            >
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 13,
                        color: inactive ? T.TEXT_HINT : T.TEXT,
                        textDecoration: row.ui_state === "invalidated" ? "line-through" : undefined,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {formatMoneyAmount(row.amount, requestCurrency)}
                </div>
                {converted && (
                    <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                        {`1 ${row.base_currency} = ${row.rate} ${row.currency}`}
                    </div>
                )}
            </div>

            <div
                className={`shrink-0 ${C.status.className}`}
                style={{ width: C.status.width }}
            >
                <Badge variant={paymentUiStateBadgeVariant(row.ui_state)}>
                    {td(paymentUiStateLabel(row.ui_state), { source: "en" })}
                </Badge>
                {timestamp && (
                    <div style={{ fontSize: 11, color: T.TEXT_HINT, marginTop: 3 }}>
                        {timestamp}
                    </div>
                )}
            </div>

            <div
                className={`shrink-0 ${C.method.className}`}
                style={{ width: C.method.width, fontSize: 12, color: T.TEXT_MUTED }}
            >
                {methodLabel}
            </div>

            <div
                className={`shrink-0 ${C.created.className}`}
                style={{ width: C.created.width, fontSize: 12, color: T.TEXT_MUTED }}
            >
                {row.created_at ? formatCompanyDateTime(row.created_at) : "—"}
            </div>

            <div
                className={`flex shrink-0 items-center justify-end gap-1.5 ${C.actions.className}`}
                style={{ width: C.actions.width }}
            >
                {row.proof_url && (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="file-text" size={12} />}
                        onClick={() => window.open(row.proof_url!, "_blank", "noreferrer")}
                    >
                        {t("pages.payment_requests.action_proof")}
                    </Button>
                )}
                {row.show_checkout_url && row.checkout_url && (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="external-link" size={12} />}
                        onClick={() => window.open(row.checkout_url!, "_blank", "noreferrer")}
                    >
                        {t("pages.payment_requests.action_checkout")}
                    </Button>
                )}
                {row.can_confirm && (
                    <Button variant="primary" size="sm" onClick={onConfirm}>
                        {t("pages.payment_requests.action_confirm")}
                    </Button>
                )}
            </div>
        </div>
    );
}
