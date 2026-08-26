import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import type {
    DealPaymentCreateInput,
    DealPaymentRequest,
    DealPaymentResponse,
} from "@/Types/api/deal-payment";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export default function useDealPayment(dealId: number) {
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
        async (input: DealPaymentCreateInput = {}) => {
            setCreating(true);
            try {
                const response = await axios.post<DealPaymentResponse>(
                    route("deals.payment-requests.store", dealId),
                    input,
                );
                if (response.data?.status === "success" && response.data.data) {
                    setPaymentRequest(response.data.data);
                    message.success("Payment request created.");
                    return response.data.data;
                }
                message.error("Unable to create payment request.");
                return null;
            } catch (error: unknown) {
                const err = error as { response?: { data?: { message?: string } } };
                message.error(
                    err.response?.data?.message ?? "Unable to create payment request.",
                );
                return null;
            } finally {
                setCreating(false);
            }
        },
        [dealId, setPaymentRequest],
    );

    const confirmTransfer = useCallback(async () => {
        setConfirming(true);
        try {
            const response = await axios.post<DealPaymentResponse>(
                route("deals.payment-request.confirm", dealId),
            );
            if (response.data?.status === "success" && response.data.data) {
                setPaymentRequest(response.data.data);
                message.success("Bank transfer confirmed.");
                return response.data.data;
            }
            message.error("Unable to confirm bank transfer.");
            return null;
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(
                err.response?.data?.message ?? "Unable to confirm bank transfer.",
            );
            return null;
        } finally {
            setConfirming(false);
        }
    }, [dealId, setPaymentRequest]);

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
