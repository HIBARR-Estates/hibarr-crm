import { useCallback, useState } from "react";
import { App } from "antd";
import axios from "axios";
import type {
    DealPaymentCreateInput,
    DealPaymentRequest,
    DealPaymentResponse,
} from "@/Types/api/deal-payment";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as {
        response?: { data?: { message?: string; error?: { message?: string } } };
    };
    return (
        err.response?.data?.message
        ?? err.response?.data?.error?.message
        ?? fallback
    );
}

export type DealPaymentActionResult =
    | { ok: true; data: DealPaymentRequest }
    | { ok: false; message: string };

export default function useDealPayment(dealId: number) {
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
    const [refreshing, setRefreshing] = useState(false);

    // A confirmed payment wins the deal server-side (outcome, and commission
    // lock once the job runs) — pull the fresh deal so the header reflects it.
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
                upsertPaymentRequest(response.data.data);
                message.success("Bank transfer confirmed.");
                void refreshDeal();
                return { ok: true, data: response.data.data };
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

    const refreshStatus = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshPaymentRequest();
            // An online payment may have completed since the last look,
            // which wins the deal the same way a confirm does.
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
        refreshStatus,
        creating,
        confirming,
        refreshing,
    };
}
