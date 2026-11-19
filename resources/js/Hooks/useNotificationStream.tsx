import { useEffect, useRef, type ReactNode } from "react";
import { usePage } from "@inertiajs/react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { PageProps } from "@/Components/DashboardLayout";
import { useNotificationAlert } from "@/Components/NotificationAlertProvider";
import type { Notification } from "@/Types/api/notification";
import {
    isAlertsMuted,
    playNotificationSound,
    showDesktopNotification,
} from "@/lib/notificationAlerts";
import {
    isSafeHttpUrl,
    isUrgentNotification,
    mapNotificationToAlert,
} from "@/lib/mapNotificationToAlert";
import { subscribeUserNotifications } from "@/lib/realtime/connection";
import { createNotificationCursorStore } from "@/lib/realtime/notificationCursor";
import { isAlertLeader, startAlertLeaderElection } from "@/lib/realtime/alertLeader";
import {
    applyCreated,
    applyRead,
    applyUnreadCount,
} from "@/lib/realtime/notificationCache";
import {
    isTruncatedNotification,
    type NotificationCreatedPayload,
    type NotificationReadPayload,
    type NotificationSinceResponse,
    type RealtimeConnectionState,
} from "@/lib/realtime/types";

/** Socket down this long before the slow catch-up timer starts. */
const FALLBACK_AFTER_MS = 20_000;
/** Catch-up cadence while — and only while — the socket is down. */
const FALLBACK_INTERVAL_MS = 60_000;
/** Bound on a catch-up loop (50 per page). */
const MAX_CATCH_UP_PAGES = 5;
/** Desktop popups per batch, newest first: a backlog must not flood the OS tray. */
const MAX_OS_POPUPS_PER_BATCH = 3;

const DISCONNECTED_STATES: RealtimeConnectionState[] = [
    "unavailable",
    "failed",
    "disconnected",
];

/**
 * Feeds notifications to the bell and the popup because the server pushed them,
 * not because the browser asked and compared.
 *
 *  - `notification.created` → into the bell's cache + the popup queue,
 *  - `notification.read`    → dismissed here when read/deleted in another tab,
 *  - every (re)subscription → one cursor-based `since` request for what the socket
 *    could not deliver (it has no replay): reconnects, page loads, outages.
 *
 * While the socket is down it falls back to that same `since` request on a slow
 * timer — the only polling left, and only when degraded.
 *
 * Mount once, inside NotificationAlertProvider, for authenticated users.
 */
export function useNotificationStream(): void {
    const { props } = usePage<PageProps>();
    const realtime = props.realtime ?? null;
    const userId = props.auth?.user?.id ?? null;
    const queryClient = useQueryClient();
    const { enqueue, dismissById } = useNotificationAlert();

    // Always the latest, without re-subscribing the socket on every render.
    const enqueueRef = useRef(enqueue);
    const dismissByIdRef = useRef(dismissById);
    enqueueRef.current = enqueue;
    dismissByIdRef.current = dismissById;

    const key = realtime?.key;
    const host = realtime?.host;
    const port = realtime?.port;
    const scheme = realtime?.scheme;
    const authEndpoint = realtime?.authEndpoint;

    useEffect(() => {
        if (!key || !host || !port || !scheme || !authEndpoint || !userId) return;

        const config = { key, host, port, scheme, authEndpoint };
        const store = createNotificationCursorStore(Number(userId));
        startAlertLeaderElection();

        let disposed = false;
        let catchingUp = false;
        let catchUpAgain = false;
        let fallbackStart: ReturnType<typeof setTimeout> | null = null;
        let fallbackInterval: ReturnType<typeof setInterval> | null = null;

        /** Sound, OS popups (one leader tab only) and the popup queue (every tab). */
        const alertFor = (items: Notification[], live: boolean) => {
            if (items.length === 0 || isAlertsMuted()) return;

            if (isAlertLeader()) {
                playNotificationSound();
                items
                    .slice(-MAX_OS_POPUPS_PER_BATCH)
                    .reverse()
                    .forEach((n) =>
                        showDesktopNotification(
                            n.title,
                            n.text,
                            n.link && isSafeHttpUrl(n.link) ? n.link : undefined,
                            n.id,
                        ),
                    );
            }

            items.forEach((n) => {
                const alert = mapNotificationToAlert(n);
                enqueueRef.current(
                    // A live push is "now"; a gap-filled one keeps its relative age.
                    live ? { ...alert, timeAgo: undefined } : alert,
                    { urgent: isUrgentNotification(n) },
                );
            });
        };

        /**
         * Delivery is at-least-once (socket + overlapping catch-up window), so the
         * applied-ids set only keeps one notification from alerting twice. It never
         * decides what is new — the server did, by sending it.
         */
        const deliver = (items: Notification[], live: boolean) => {
            const fresh = items.filter((n) => !store.hasApplied(n.id));

            fresh.forEach((n) => {
                store.markApplied(n.id);
                store.advance(n.created_at);
            });

            alertFor(fresh, live);

            return fresh;
        };

        const catchUp = async (): Promise<void> => {
            if (catchingUp) {
                catchUpAgain = true;
                return;
            }
            catchingUp = true;

            try {
                for (let page = 0; page < MAX_CATCH_UP_PAGES && !disposed; page++) {
                    const cursor = store.getCursor();
                    const { data: response } = await axios.get<NotificationSinceResponse>(
                        route("notifications.api.since"),
                        { params: cursor ? { cursor } : {} },
                    );

                    if (disposed || response?.status !== "success") return;
                    const result = response.data;

                    if (!cursor) {
                        // First ever load: just learn where "now" is. History is not replayed as popups.
                        store.advance(result.server_time);
                        applyUnreadCount(queryClient, result.unread_count);
                        return;
                    }

                    const fresh = deliver(result.notifications, false);
                    fresh.forEach((n) => applyCreated(queryClient, n, null));
                    store.advance(result.next_cursor);
                    applyUnreadCount(queryClient, result.unread_count);

                    if (!result.has_more) break;
                }
            } catch {
                // Offline or a server hiccup: the next subscription / fallback tick retries.
            } finally {
                catchingUp = false;
                if (catchUpAgain && !disposed) {
                    catchUpAgain = false;
                    void catchUp();
                }
            }
        };

        const onCreated = (payload: NotificationCreatedPayload) => {
            const notification = payload.notification;

            // Too big for the socket: only the id came through. The row is in the
            // database, so the catch-up window picks it up.
            if (isTruncatedNotification(notification)) {
                void catchUp();
                return;
            }

            const fresh = deliver([notification], true);
            if (fresh.length > 0) {
                applyCreated(queryClient, notification, payload.unread_count);
            }
        };

        const onRead = (payload: NotificationReadPayload) => {
            applyRead(queryClient, payload);
            dismissByIdRef.current(payload.all ? "all" : payload.ids);
        };

        const stopFallback = () => {
            if (fallbackStart) clearTimeout(fallbackStart);
            if (fallbackInterval) clearInterval(fallbackInterval);
            fallbackStart = null;
            fallbackInterval = null;
        };

        const onState = (state: RealtimeConnectionState) => {
            if (state === "connected") {
                stopFallback();
                return;
            }

            if (
                DISCONNECTED_STATES.includes(state) &&
                !fallbackStart &&
                !fallbackInterval
            ) {
                fallbackStart = setTimeout(() => {
                    fallbackStart = null;
                    void catchUp();
                    fallbackInterval = setInterval(
                        () => void catchUp(),
                        FALLBACK_INTERVAL_MS,
                    );
                }, FALLBACK_AFTER_MS);
            }
        };

        const onVisible = () => {
            if (!document.hidden) void catchUp();
        };

        const unsubscribe = subscribeUserNotifications(config, Number(userId), {
            onCreated,
            onRead,
            onSubscribed: () => void catchUp(),
            onState,
        });
        document.addEventListener("visibilitychange", onVisible);

        return () => {
            disposed = true;
            unsubscribe();
            stopFallback();
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [key, host, port, scheme, authEndpoint, userId, queryClient]);
}

/** Skips guests: no notification feed before login, and nothing to connect without a config. */
export function NotificationStreamMount(): ReactNode {
    const { props } = usePage<PageProps>();
    if (!props.auth?.user || !props.realtime) return null;
    return <AuthenticatedNotificationStream />;
}

function AuthenticatedNotificationStream(): null {
    useNotificationStream();
    return null;
}
