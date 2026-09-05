import { useCallback, useState } from "react";
import axios from "axios";

export interface MetaTestSendResult {
    success: boolean;
    event_name: string;
    value: number;
    status_code: number | null;
    fbtrace_id: string | null;
    error: string | null;
    events_received: number | null;
}

interface TestSendPayload {
    lead_id: number;
    event_name: string;
    value: number;
}

/** Sends a real Meta Conversions API event for one lead outside of any
 * automation, via MetaEventController::sendTest — lets an admin verify the
 * pixel/access token and payload against a real record. Always synchronous:
 * the caller wants Meta's actual response, not a "queued" placeholder. */
export default function useMetaEventTestSend() {
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<MetaTestSendResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sendTest = useCallback(async (payload: TestSendPayload): Promise<MetaTestSendResult | null> => {
        setSending(true);
        setErrorMessage(null);
        try {
            const res = await axios.post(route("meta-events.send-test"), payload, {
                headers: { Accept: "application/json" },
            });
            if (res.data?.status === "success" && res.data?.data) {
                const data = res.data.data as MetaTestSendResult;
                setResult(data);
                return data;
            }
            setErrorMessage(res.data?.message || "Something went wrong.");
            return null;
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Something went wrong.");
            return null;
        } finally {
            setSending(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setErrorMessage(null);
    }, []);

    return { sendTest, sending, result, errorMessage, reset };
}
