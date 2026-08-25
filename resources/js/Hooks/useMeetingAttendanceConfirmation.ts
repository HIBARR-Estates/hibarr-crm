import { useCallback, useState } from "react";
import { useApiQuery } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { PendingMeetingAttendanceConfirmation } from "@/Types/api/meeting-attendance-confirmation";

const POLL_MS = 60_000;

/**
 * Polls for a single pending meeting-attendance confirmation for the current
 * user. Dismissing (Cancel/Close, no outcome chosen) only hides it for this
 * browser session — the server still considers it unresolved and it resurfaces
 * on the next session/page load.
 */
export function useMeetingAttendanceConfirmation(enabled: boolean) {
    const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

    const { data: response, refetch } = useApiQuery<
        ApiResponse<PendingMeetingAttendanceConfirmation | null>
    >({
        path: route("meetings.api.attendance_confirmation.pending"),
        options: { enabled, refetchInterval: enabled ? POLL_MS : false },
    });

    const pending =
        response && isSuccessResponse(response) ? response.data ?? null : null;

    const current = pending && !dismissedIds.has(pending.id) ? pending : null;

    const dismiss = useCallback((id: number) => {
        setDismissedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    /** Call after a successful confirm to immediately pull the next pending meeting, if any. */
    const resolve = useCallback(() => {
        refetch();
    }, [refetch]);

    return { current, dismiss, resolve };
}
