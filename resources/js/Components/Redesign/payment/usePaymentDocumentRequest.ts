import { useCallback, useState } from "react";
import { App } from "antd";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";

/**
 * Records that the customer asked for an invoice on one payment request.
 * Invoices and receipts exist only after this, and only then does KDV come
 * on top of the net amount checkout collected.
 */
export default function usePaymentDocumentRequest() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [requesting, setRequesting] = useState(false);

    const requestDocuments = useCallback(
        async (dealId: number, paymentId: number): Promise<DealPaymentRequest | null> => {
            setRequesting(true);
            try {
                const response = await axios.post<{ status?: string; data?: DealPaymentRequest }>(
                    route("deals.payment-requests.documents.request", { deal: dealId, payment: paymentId }),
                );
                if (response.data?.status === "success" && response.data.data) {
                    message.success(t("pages.payment_requests.invoice_requested_toast"));
                    return response.data.data;
                }
                message.error(t("pages.payment_requests.invoice_request_failed"));
                return null;
            } catch (error: unknown) {
                const text = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
                message.error(text || t("pages.payment_requests.invoice_request_failed"));
                return null;
            } finally {
                setRequesting(false);
            }
        },
        [message, t],
    );

    /** Read-only check of a request's state; works for viewers who cannot request. */
    const fetchStatus = useCallback(async (dealId: number, paymentId: number): Promise<DealPaymentRequest | null> => {
        try {
            const response = await axios.get<{ status?: string; data?: DealPaymentRequest }>(
                route("deals.payment-requests.documents.status", { deal: dealId, payment: paymentId }),
            );
            return response.data?.status === "success" ? (response.data.data ?? null) : null;
        } catch {
            return null;
        }
    }, []);

    return { requestDocuments, fetchStatus, requesting };
}
