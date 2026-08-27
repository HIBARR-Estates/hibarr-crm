import { useCallback, useEffect, useState } from "react";
import { useApiQuery } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { PendingMeetingAttendanceConfirmation } from "@/Types/api/meeting-attendance-confirmation";

const POLL_MS = 60_000;

function sortByScheduledAt(
    items: PendingMeetingAttendanceConfirmation[],
): PendingMeetingAttendanceConfirmation[] {
    return [...items].sort((a, b) =>
        (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""),
    );
}

/**
 * Polls the list of pending meeting-attendance confirmations for the current
 * user and holds them as local state — the source of truth the dock renders
 * from, so a snooze/undo/resolve can update it immediately instead of
 * waiting on the next poll.
 *
 * This hook only tracks list state; the actual confirm/snooze/undo API calls
 * are made by the components that already know a concrete meeting id at
 * render time (the modal, the current dock card, the notification's Undo
 * action). Once one of those calls succeeds, it reports back here via
 * `remove`/`restore` to patch this list.
 *
 * A poll response only ever ADDS ids `items` doesn't already know about and
 * DROPS ids it no longer reports; it never clobbers an item that's only
 * hidden locally pending an in-flight mutation, because by the time this
 * hook is told about a resolve/snooze the server has already committed it —
 * so the next poll agrees rather than fighting it.
 */
export function useMeetingAttendanceConfirmations(enabled: boolean) {
    const [items, setItems] = useState<PendingMeetingAttendanceConfirmation[]>([]);

    const { data: response } = useApiQuery<
        ApiResponse<PendingMeetingAttendanceConfirmation[]>
    >({
        path: route("meetings.api.attendance_confirmation.pending"),
        options: { enabled, refetchInterval: enabled ? POLL_MS : false },
    });

    useEffect(() => {
        if (!response || !isSuccessResponse(response)) return;
        const serverItems = response.data ?? [];

        setItems((prev) => {
            const prevIds = new Set(prev.map((i) => i.id));
            const serverIds = new Set(serverItems.map((i) => i.id));
            const kept = prev.filter((i) => serverIds.has(i.id));
            const added = serverItems.filter((i) => !prevIds.has(i.id));
            return sortByScheduledAt([...kept, ...added]);
        });
    }, [response]);

    /** Removes `id` from the local list — e.g. after a successful confirm mutation. */
    const remove = useCallback((id: number) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);

    /** Hides `item` locally — e.g. right when a snooze is fired, without waiting for the response. */
    const snoozeLocally = useCallback((item: PendingMeetingAttendanceConfirmation) => {
        remove(item.id);
    }, [remove]);

    /** Re-inserts `item` (e.g. after an Undo), keeping the list's scheduled-time order. */
    const restore = useCallback((item: PendingMeetingAttendanceConfirmation) => {
        setItems((prev) =>
            prev.some((i) => i.id === item.id) ? prev : sortByScheduledAt([...prev, item]),
        );
    }, []);

    return { items, remove, snoozeLocally, restore };
}
