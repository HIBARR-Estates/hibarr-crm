import { useCallback, useEffect, useMemo, useState } from "react";
import { ZohoCalendarSyncService } from "@/Services/ZohoCalendarSyncService";
import type {
    ZohoCalendarEventJobStatusData,
    ZohoCalendarSyncUiStatus,
} from "@/Types/zoho-calendar-sync";

type PollerOptions = {
    jobId: string | null | undefined;
    initialStatus: ZohoCalendarSyncUiStatus | null | undefined;
    intervalMs?: number;
    maxAttempts?: number;
    enabled?: boolean;
};

function mapOlStatusToUiStatus(
    data: ZohoCalendarEventJobStatusData,
): ZohoCalendarSyncUiStatus {
    if (data.error || data.status === "failed") return "failed";
    if (data.status === "pending") return "pending";

    // OL may return other terminal values (e.g. "completed") while still
    // representing a successful sync.
    if (data.zohoEventId) return "synced";

    return "synced";
}

export function useZohoCalendarJobPoller({
    jobId,
    initialStatus,
    intervalMs = 5000,
    maxAttempts = 5,
    enabled = true,
}: PollerOptions) {
    const service = useMemo(() => new ZohoCalendarSyncService(), []);

    const [status, setStatus] = useState<ZohoCalendarSyncUiStatus | null>(
        initialStatus ?? (jobId ? "pending" : null),
    );
    const [attemptsMade, setAttemptsMade] = useState(0);
    const [hasMaxAttempts, setHasMaxAttempts] = useState(false);
    const [isPolling, setIsPolling] = useState(false);

    useEffect(() => {
        setStatus(initialStatus ?? (jobId ? "pending" : null));
        setAttemptsMade(0);
        setHasMaxAttempts(false);
        // We intentionally do not include intervalMs/maxAttempts to avoid
        // restarting mid-poll when those props change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobId, initialStatus]);

    const refresh = useCallback(() => {
        if (!jobId) return;
        setStatus("pending");
        setAttemptsMade(0);
        setHasMaxAttempts(false);
    }, [jobId]);

    useEffect(() => {
        if (!enabled) return;
        if (!jobId) return;
        if (hasMaxAttempts) return;
        if (status !== "pending") return;

        let isMounted = true;

        const pollOnce = async (attempt: number) => {
            if (!isMounted) return;

            setAttemptsMade(attempt);

            try {
                const response = await service.getJobStatus(jobId);
                if (!isMounted) return;

                const nextStatus = mapOlStatusToUiStatus(
                    response.data,
                );

                if (nextStatus !== "pending") {
                    setStatus(nextStatus);
                    setIsPolling(false);
                    return;
                }

                if (attempt >= maxAttempts) {
                    setHasMaxAttempts(true);
                    setIsPolling(false);
                    return;
                }

                // Keep polling while pending.
                window.setTimeout(
                    () => pollOnce(attempt + 1),
                    intervalMs,
                );
            } catch {
                if (!isMounted) return;

                if (attempt >= maxAttempts) {
                    setHasMaxAttempts(true);
                    setIsPolling(false);
                    return;
                }

                window.setTimeout(
                    () => pollOnce(attempt + 1),
                    intervalMs,
                );
            }
        };

        setIsPolling(true);
        pollOnce(1);

        return () => {
            isMounted = false;
        };
    }, [
        enabled,
        jobId,
        status,
        hasMaxAttempts,
        intervalMs,
        maxAttempts,
        service,
    ]);

    return {
        status,
        attemptsMade,
        isPolling,
        hasMaxAttempts,
        refresh,
    };
}

