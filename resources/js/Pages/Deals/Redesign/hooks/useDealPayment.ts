import { useCallback, useState } from "react";
import { App } from "antd";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
import type {
    DealPaymentCreateInput,
    DealPaymentRequest,
    DealPaymentResponse,
} from "@/Types/api/deal-payment";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

function stringifyMessage(value: unknown): string | null {
    if (typeof value === "string" && value.trim() !== "") {
        return value.trim();
    }
    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => {
                if (typeof entry === "string") return entry.trim();
                if (
                    entry
                    && typeof entry === "object"
                    && "message" in entry
                    && typeof (entry as { message: unknown }).message === "string"
                ) {
                    return (entry as { message: string }).message.trim();
                }
                return "";
            })
            .filter(Boolean);
        return parts.length > 0 ? parts.join(" ") : null;
    }
    return null;
}

function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: {
            data?: {
                message?: unknown;
                error?: { message?: unknown } | string;
            };
        };
    };
    const data = err.response?.data;
    return (
        stringifyMessage(data?.message)
        ?? stringifyMessage(
            typeof data?.error === "object" && data.error !== null
                ? data.error.message
                : typeof data?.error === "string"
                  ? data.error
                  : null,
        )
        ?? fallback
    );
}

export type DealPaymentActionResult =
    | { ok: true; data: DealPaymentRequest }
    | { ok: false; message: string };

export default function useDealPayment(dealId: number) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const {
        paymentRequest,
        paymentRequests,
        upsertPaymentRequest,
        refreshPaymentRequest,
        paymentRequestLoading,
        setDeal,
    } = useDealWorkspace();
    const [creating, setCreating] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Pull the deal again after a payment is confirmed. The outcome changes
    // only when accepted payments add up to the deal value.
    const refreshDeal = useCallback(async () => {
        try {
            const refreshed = await axios.get(route("deals.refresh", dealId));
            if (refreshed.data?.status === "success" && refreshed.data?.data) {
                setDeal(refreshed.data.data);
            }
        } catch {
            // Non-critical: the payment itself is already confirmed.
        }
    }, [dealId, setDeal]);

    const createPaymentRequest = useCallback(
        async (input: DealPaymentCreateInput): Promise<DealPaymentActionResult> => {
            setCreating(true);
            try {
                const response = await axios.post<DealPaymentResponse>(
                    route("deals.payment-requests.store", dealId),
                    input,
                );
                if (response.data?.status === "success" && response.data.data) {
                    upsertPaymentRequest(response.data.data);
                    message.success("Payment request created.");
                    return { ok: true, data: response.data.data };
                }
                const failMessage =
                    (response.data as { message?: string } | undefined)?.message
                    ?? "Unable to create payment request.";
                message.error(failMessage);
                return { ok: false, message: failMessage };
            } catch (error: unknown) {
                const failMessage = apiErrorMessage(
                    error,
                    "Unable to create payment request.",
                );
                message.error(failMessage);
                return { ok: false, message: failMessage };
            } finally {
                setCreating(false);
            }
        },
        [dealId, message, upsertPaymentRequest],
    );

    const confirmTransfer = useCallback(async (): Promise<DealPaymentActionResult> => {
        setConfirming(true);
        try {
            const response = await axios.post<DealPaymentResponse>(
                route("deals.payment-request.confirm", dealId),
            );
            if (response.data?.status === "success" && response.data.data) {
                const confirmed = response.data.data;
                const cash = confirmed.gateway === "cash" || confirmed.ol_payment_type === "cash";
                upsertPaymentRequest(confirmed);
                message.success(cash ? "Cash payment confirmed." : "Bank transfer confirmed.");
                void refreshDeal();
                return { ok: true, data: confirmed };
            }
            const failMessage =
                (response.data as { message?: string } | undefined)?.message
                ?? "Unable to confirm bank transfer.";
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } catch (error: unknown) {
            const failMessage = apiErrorMessage(
                error,
                "Unable to confirm bank transfer.",
            );
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } finally {
            setConfirming(false);
        }
    }, [dealId, message, refreshDeal, upsertPaymentRequest]);

    const cancelRequest = useCallback(async (): Promise<DealPaymentActionResult> => {
        setCancelling(true);
        try {
            const response = await axios.post<DealPaymentResponse>(
                route("deals.payment-request.cancel", dealId),
            );
            if (response.data?.status === "success" && response.data.data) {
                upsertPaymentRequest(response.data.data);
                message.success(t("pages.deals.payment_request.cancelled_toast"));
                return { ok: true, data: response.data.data };
            }
            const failMessage =
                (response.data as { message?: string } | undefined)?.message
                ?? t("pages.deals.payment_request.cancel_failed");
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } catch (error: unknown) {
            const failMessage = apiErrorMessage(
                error,
                t("pages.deals.payment_request.cancel_failed"),
            );
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } finally {
            setCancelling(false);
        }
    }, [dealId, message, t, upsertPaymentRequest]);

    const retryRequest = useCallback(async (paymentId: number): Promise<DealPaymentActionResult> => {
        setRetrying(true);
        try {
            const response = await axios.post<DealPaymentResponse>(
                route("deals.payment-requests.retry", { deal: dealId, payment: paymentId }),
            );
            if (response.data?.status === "success") {
                await refreshPaymentRequest();
                message.success(t("pages.deals.payment_request.retry_toast"));
                return { ok: true, data: response.data.data };
            }
            const failMessage =
                (response.data as { message?: string } | undefined)?.message
                ?? t("pages.deals.payment_request.retry_failed");
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } catch (error: unknown) {
            const failMessage = apiErrorMessage(
                error,
                t("pages.deals.payment_request.retry_failed"),
            );
            message.error(failMessage);
            return { ok: false, message: failMessage };
        } finally {
            setRetrying(false);
        }
    }, [dealId, message, refreshPaymentRequest, t]);

    const refreshStatus = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshPaymentRequest();
            // An online payment may have completed since the last look.
            await refreshDeal();
        } finally {
            setRefreshing(false);
        }
    }, [refreshDeal, refreshPaymentRequest]);

    return {
        paymentRequest,
        paymentRequests,
        paymentRequestLoading,
        createPaymentRequest,
        confirmTransfer,
        cancelRequest,
        retryRequest,
        refreshStatus,
        creating,
        confirming,
        cancelling,
        retrying,
        refreshing,
    };
}
