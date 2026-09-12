import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarSyncService } from "@/Services/CalendarSyncService";
import { useCalendarSyncJobPoller } from "@/Hooks/useCalendarSyncJobPoller";
import type { CalendarSyncUiStatus } from "@/Types/calendar-sync";
import type { DealFollowup } from "@/Types/api/deal-followup";

export const CALENDAR_SYNC_FLAG = "integrations.zoho-calendar-sync";

/** Creator or host — the only people the sync endpoints answer. */
export function canManageCalendarSync(
    followup: DealFollowup | null | undefined,
    userId: number | null | undefined,
): boolean {
    if (!followup || !userId) return false;
    // `added_by` is the loaded user on detail payloads, a bare id on others.
    const addedBy = followup.added_by as unknown as
        | { id?: number }
        | number
        | null
        | undefined;
    const addedById = typeof addedBy === "number" ? addedBy : addedBy?.id;

    return addedById === userId || followup.host_id === userId;
}

/**
 * One meeting's calendar sync: its live status (polled while pending), the
 * last failure reason, and a retry. Errors stay English source strings —
 * translate at the render site.
 */
export default function useCalendarSync(
    followup: DealFollowup,
    enabled: boolean,
) {
    const service = useMemo(() => new CalendarSyncService(), []);
    const [jobId, setJobId] = useState<string | null>(
        followup.zoho_calendar_job_id ?? null,
    );
    const [syncStatus, setSyncStatus] = useState<CalendarSyncUiStatus | null>(
        followup.zoho_calendar_sync_status ?? null,
    );
    const [error, setError] = useState<string | null>(
        followup.zoho_calendar_sync_error ?? null,
    );
    const [retrying, setRetrying] = useState(false);

    // A different meeting starts from its own stored state.
    useEffect(() => {
        setJobId(followup.zoho_calendar_job_id ?? null);
        setSyncStatus(followup.zoho_calendar_sync_status ?? null);
        setError(followup.zoho_calendar_sync_error ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed per meeting, not per re-render
    }, [followup.id]);

    const { status, hasMaxAttempts, refresh } = useCalendarSyncJobPoller({
        followUpId: followup.id,
        jobId,
        initialStatus: syncStatus,
        enabled,
        intervalMs: 5000,
        maxAttempts: 5,
        onStatus: (data) => {
            if (data.jobId !== undefined) setJobId(data.jobId);
            if (data.syncStatus) setSyncStatus(data.syncStatus);
            setError(data.error?.message ?? null);
        },
    });

    const retry = useCallback(async () => {
        setRetrying(true);
        try {
            const result = await service.retry(followup.id);
            setJobId(result.data.jobId ?? null);
            setSyncStatus(
                result.data.syncStatus ?? (result.ok ? "pending" : "failed"),
            );
            setError(
                result.ok
                    ? null
                    : result.message ||
                          result.data.error?.message ||
                          "Calendar sync failed.",
            );
            // A retry that returns the same jobId/status wouldn't restart the
            // poller on its own — reset it so an exhausted poll resumes.
            if (result.ok) refresh();
        } catch {
            setSyncStatus("failed");
            setError("Could not reach the server to retry the sync.");
        } finally {
            setRetrying(false);
        }
    }, [followup.id, refresh, service]);

    return { status, error, retry, retrying, hasMaxAttempts, refresh };
}
