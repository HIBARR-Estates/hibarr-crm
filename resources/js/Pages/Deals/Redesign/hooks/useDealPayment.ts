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
        setPaymentRequest,
        refreshPaymentRequest,
        paymentRequestLoading,
    } = useDealWorkspace();
    const [creating, setCreating] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const createPaymentRequest = useCallback(
        async (input: DealPaymentCreateInput = {}): Promise<DealPaymentActionResult> => {
            setCreating(true);
            try {
                const response = await axios.post<DealPaymentResponse>(
                    route("deals.payment-requests.store", dealId),
                    input,
                );
                if (response.data?.status === "success" && response.data.data) {
                    setPaymentRequest(response.data.data);
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
        [dealId, message, setPaymentRequest],
    );

    const confirmTransfer = useCallback(async (): Promise<DealPaymentActionResult> => {
        setConfirming(true);
        try {
            const response = await axios.post<DealPaymentResponse>(
                route("deals.payment-request.confirm", dealId),
            );
            if (response.data?.status === "success" && response.data.data) {
                setPaymentRequest(response.data.data);
                message.success("Bank transfer confirmed.");
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
    }, [dealId, message, setPaymentRequest]);

    const refreshStatus = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshPaymentRequest();
        } finally {
            setRefreshing(false);
        }
    }, [refreshPaymentRequest]);

    return {
        paymentRequest,
        paymentRequestLoading,
        createPaymentRequest,
        confirmTransfer,
        refreshStatus,
        creating,
        confirming,
        refreshing,
    };
}
