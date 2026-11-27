import type { Notification } from "@/Types/api/notification";

/** The `realtime` Inertia prop (see RealtimeNotifications::clientConfig). Public values only. */
export interface RealtimeConfig {
    key: string;
    host: string;
    port: number;
    scheme: string;
    authEndpoint: string;
}

/** Sent when the full message would exceed the socket server's size limit. */
export interface TruncatedNotification {
    id: string;
    created_at: string | null;
    truncated: true;
}

export type RealtimeNotification = Notification | TruncatedNotification;

export function isTruncatedNotification(
    value: RealtimeNotification,
): value is TruncatedNotification {
    return (value as TruncatedNotification).truncated === true;
}

/** `notification.created` */
export interface NotificationCreatedPayload {
    notification: RealtimeNotification;
    unread_count: number;
}

/** `notification.read` — notifications stopped being unread (read or deleted). */
export interface NotificationReadPayload {
    ids: string[];
    all: boolean;
    refresh: boolean;
    unread_count: number;
}

/** GET api/notifications/since */
export interface NotificationSinceResponse {
    status: "success" | "fail";
    data: {
        notifications: Notification[];
        has_more: boolean;
        next_cursor: string;
        server_time: string;
        unread_count: number;
    };
}

export type RealtimeConnectionState =
    | "initialized"
    | "connecting"
    | "connected"
    | "unavailable"
    | "failed"
    | "disconnected";
