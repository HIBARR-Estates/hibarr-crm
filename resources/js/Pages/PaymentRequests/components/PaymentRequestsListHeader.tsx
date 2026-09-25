import useTranslation from "@/Hooks/useTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { PAYMENT_REQUEST_COLUMNS as C } from "./PaymentRequestRow";

/**
 * Column headings for the list — same band as the Meetings list header,
 * sized from `PaymentRequestRow`'s own column table so the two stay aligned
 * at every breakpoint.
 */
export default function PaymentRequestsListHeader() {
    const { t } = useTranslation();

    return (
        <div
            className="flex items-center gap-4 px-4 py-2.5 uppercase"
            style={{
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER}`,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: T.TEXT,
            }}
        >
            <span className="min-w-0 flex-1">{t("pages.payment_requests.col_deal")}</span>
            <span
                className={`shrink-0 ${C.dealValue.className}`}
                style={{ width: C.dealValue.width }}
            >
                {t("pages.payment_requests.col_deal_value")}
            </span>
            <span
                className={`shrink-0 ${C.requested.className}`}
                style={{ width: C.requested.width }}
            >
                {t("pages.payment_requests.col_requested")}
            </span>
            <span
                className={`shrink-0 ${C.status.className}`}
                style={{ width: C.status.width }}
            >
                {t("pages.payment_requests.col_status")}
            </span>
            <span
                className={`shrink-0 ${C.method.className}`}
                style={{ width: C.method.width }}
            >
                {t("pages.payment_requests.col_method")}
            </span>
            <span
                className={`shrink-0 ${C.created.className}`}
                style={{ width: C.created.width }}
            >
                {t("pages.payment_requests.col_created")}
            </span>
            <span
                className={`shrink-0 ${C.actions.className}`}
                style={{ width: C.actions.width }}
                aria-hidden
            />
        </div>
    );
}
