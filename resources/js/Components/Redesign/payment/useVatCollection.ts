import { useCallback, useState } from "react";
import { App } from "antd";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import type { DealPaymentRequest } from "@/Types/api/deal-payment";

interface VatResponse {
    status?: string;
    message?: string;
    data?: DealPaymentRequest;
    /** Only when a KDV payment request was raised. */
    request?: DealPaymentRequest;
}

export type VatSettleMethod = "cash" | "external";

/**
 * Collects the KDV owed on a collected payment: a second payment request for
 * the KDV, or recording it as received in cash or outside the CRM.
 * Each action resolves with the updated payment (and the new request), or
 * null when it failed.
 */
export default function useVatCollection() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [saving, setSaving] = useState(false);

    const run = useCallback(
        async (url: string, body: Record<string, string>, success: string) => {
            setSaving(true);
            try {
                const response = await axios.post<VatResponse>(url, body);
                if (response.data?.status === "success" && response.data.data) {
                    message.success(success);
                    return { payment: response.data.data, request: response.data.request ?? null };
                }
                message.error(response.data?.message || t("pages.payment_requests.vat_failed"));
                return null;
            } catch (error: unknown) {
                const text = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
                message.error(text || t("pages.payment_requests.vat_failed"));
                return null;
            } finally {
                setSaving(false);
            }
        },
        [message, t],
    );

    /** Raises a second payment request for the KDV; the customer picks how to pay. */
    const requestVat = useCallback(
        (dealId: number, paymentId: number) =>
            run(
                route("deals.payment-requests.vat.request", { deal: dealId, payment: paymentId }),
                {},
                t("pages.payment_requests.vat_requested_toast"),
            ),
        [run, t],
    );

    const settleVat = useCallback(
        (dealId: number, paymentId: number, method: VatSettleMethod) =>
            run(
                route("deals.payment-requests.vat.settle", { deal: dealId, payment: paymentId }),
                { method },
                t("pages.payment_requests.vat_settled_toast"),
            ),
        [run, t],
    );

    return { requestVat, settleVat, saving };
}
