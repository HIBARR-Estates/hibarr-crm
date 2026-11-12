import useTranslation from "@/Hooks/useTranslation";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";
import { PAYMENT_REQUEST_GRID } from "./PaymentRequestRow";

/** Column headings, aligned with the row. */
export default function PaymentRequestsListHeader() {
    const { t } = useTranslation();

    return (
        <div
            className="items-center px-4 py-3 uppercase"
            style={{
                display: "grid",
                gridTemplateColumns: PAYMENT_REQUEST_GRID,
                columnGap: 16,
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER}`,
                fontSize: REDESIGN_TYPE.CAPTION,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: T.TEXT_MUTED,
            }}
        >
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.col_deal")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.detail_lead")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.detail_agent")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.col_requested")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.col_status")}</span>
            <span aria-hidden />
        </div>
    );
}
