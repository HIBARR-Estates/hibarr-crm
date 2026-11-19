import type { QueryClient } from "@tanstack/react-query";
import type {
    Notification,
    NotificationUnreadSummaryResponse,
} from "@/Types/api/notification";
import type { NotificationReadPayload } from "./types";

/** Matches the server's default `limit` for unread-summary. */
const SUMMARY_LIMIT = 6;

/**
 * Must match useApiQuery's real cache key ([path, params]) exactly: setQueryData
 * does exact key matching, unlike invalidateQueries' prefix matching.
 */
function summaryKey(): [string, undefined] {
    return [route("notifications.api.unread_summary"), undefined];
}

/** A pushed notification goes straight into the bell's cache. */
export function applyCreated(
    queryClient: QueryClient,
    notification: Notification,
    unreadCount: number | null,
): void {
    queryClient.setQueryData<NotificationUnreadSummaryResponse>(
        summaryKey(),
        (old) => {
            // Not loaded yet: that fetch will include this row, it is already in the DB.
            if (!old?.data) return old;

            const already = old.data.notifications.some((n) => n.id === notification.id);
            const notifications = [
                notification,
                ...old.data.notifications.filter((n) => n.id !== notification.id),
            ].slice(0, SUMMARY_LIMIT);

            return {
                ...old,
                data: {
                    ...old.data,
                    unread_count:
                        unreadCount ?? old.data.unread_count + (already ? 0 : 1),
                    notifications,
                },
            };
        },
    );

    // The full notifications page lists everything; let it refresh when it is mounted.
    void queryClient.invalidateQueries({
        queryKey: [route("notifications.api.index")],
    });
}

/** Another tab/device read or deleted notifications. */
export function applyRead(
    queryClient: QueryClient,
    payload: NotificationReadPayload,
): void {
    queryClient.setQueryData<NotificationUnreadSummaryResponse>(
        summaryKey(),
        (old) => {
            if (!old?.data) return old;

            const removed = new Set(payload.ids);
            return {
                ...old,
                data: {
                    ...old.data,
                    unread_count: payload.unread_count,
                    notifications: payload.all
                        ? []
                        : old.data.notifications.filter((n) => !removed.has(n.id)),
                },
            };
        },
    );

    // The summary only holds the newest few: refill it after anything was removed.
    void queryClient.invalidateQueries({
        queryKey: [route("notifications.api.unread_summary")],
    });
    void queryClient.invalidateQueries({
        queryKey: [route("notifications.api.index")],
    });
}

/** Server count from a catch-up response, when no individual items changed. */
export function applyUnreadCount(
    queryClient: QueryClient,
    unreadCount: number,
): void {
    queryClient.setQueryData<NotificationUnreadSummaryResponse>(
        summaryKey(),
        (old) =>
            old?.data
                ? { ...old, data: { ...old.data, unread_count: unreadCount } }
                : old,
    );
}
