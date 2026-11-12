import useTranslation from "@/Hooks/useTranslation";
import { REDESIGN_TOKENS as T, REDESIGN_TYPE } from "@/Components/Redesign/tokens";

/** Column headings, aligned with the row. */
export default function PaymentRequestsListHeader() {
    const { t } = useTranslation();

    return (
        <div
            className="items-center py-3 uppercase"
            style={{
                display: "grid",
                gridColumn: "1 / -1",
                gridTemplateColumns: "subgrid",
                alignItems: "center",
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER}`,
                fontSize: REDESIGN_TYPE.CAPTION,
                fontWeight: 700,
                letterSpacing: "0.05em",
                color: T.TEXT_MUTED,
            }}
        >
            <span style={{ minWidth: 0, paddingLeft: 16 }}>{t("pages.payment_requests.col_deal")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.detail_lead")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.detail_agent")}</span>
            <span style={{ minWidth: 0 }}>{t("pages.payment_requests.col_requested")}</span>
            <span>{t("pages.payment_requests.col_status")}</span>
            <span aria-hidden style={{ paddingRight: 16 }} />
        </div>
    );
}
