import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarSyncService } from "@/Services/CalendarSyncService";
import type {
    CalendarSyncStatusData,
    CalendarSyncUiStatus,
} from "@/Types/calendar-sync";

type PollerOptions = {
    followUpId: number | string;
    jobId: string | null | undefined;
    initialStatus: CalendarSyncUiStatus | null | undefined;
    intervalMs?: number;
    maxAttempts?: number;
    enabled?: boolean;
    onStatus?: (data: CalendarSyncStatusData) => void;
};

function mapProxyStatusToUiStatus(
    data: CalendarSyncStatusData,
): CalendarSyncUiStatus {
    if (data.error || data.syncStatus === "failed") return "failed";
    if (data.syncStatus === "synced") return "synced";
    if (data.syncStatus === "pending") return "pending";

    return "pending";
}

export function useCalendarSyncJobPoller({
    followUpId,
    jobId,
    initialStatus,
    intervalMs = 5000,
    maxAttempts = 5,
    enabled = true,
    onStatus,
}: PollerOptions) {
    const service = useMemo(() => new CalendarSyncService(), []);
    const onStatusRef = useRef(onStatus);
    onStatusRef.current = onStatus;

    const [status, setStatus] = useState<CalendarSyncUiStatus | null>(
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
    }, [followUpId, jobId, initialStatus]);

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
                const response = await service.getJobStatus(followUpId);
                if (!isMounted) return;

                const payload = response.data;
                onStatusRef.current?.(payload);

                const nextStatus = mapProxyStatusToUiStatus(payload);

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
        followUpId,
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
