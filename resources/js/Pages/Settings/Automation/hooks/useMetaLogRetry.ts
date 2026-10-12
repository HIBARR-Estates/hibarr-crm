import { useCallback, useState } from "react";
import axios from "axios";

export interface MetaLogRetryResult {
    success: boolean;
    log_id: number;
    error: string | null;
    status_code: number | null;
}

/** Re-sends one failed Meta conversion step from Run History
 * (DealAutomationController::retryMetaLog). Sends only that event — it never
 * re-runs the automation or touches any dispatch marker. */
export default function useMetaLogRetry() {
    const [retrying, setRetrying] = useState(false);
    const [result, setResult] = useState<MetaLogRetryResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const retry = useCallback(async (logId: number): Promise<MetaLogRetryResult | null> => {
        setRetrying(true);
        setErrorMessage(null);
        try {
            const res = await axios.post(route("deal-automations.log-retry-meta", logId), {}, {
                headers: { Accept: "application/json" },
            });
            if (res.data?.status === "success" && res.data?.data) {
                const data = res.data.data as MetaLogRetryResult;
                setResult(data);
                return data;
            }
            setErrorMessage(res.data?.message || "Something went wrong.");
            return null;
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || "Something went wrong.");
            return null;
        } finally {
            setRetrying(false);
        }
    }, []);

    return { retry, retrying, result, errorMessage };
}
