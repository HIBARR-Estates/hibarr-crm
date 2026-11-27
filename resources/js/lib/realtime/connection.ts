/**
 * One WebSocket connection per tab to the self-hosted realtime server (Pusher
 * protocol), shared by everything that needs it.
 *
 * - pusher-js is imported lazily, after first paint: nothing here may block it.
 * - Channel authorization goes through axios so the XSRF cookie is used. The
 *   <meta name="csrf-token"> is not reliable (the Mix layout has none, and
 *   impersonation rotates the session token).
 * - The connection belongs to one user. A different user id (impersonation) tears
 *   it down and starts a new one, so a socket never outlives its owner.
 */
import axios from "axios";
import type Pusher from "pusher-js";
import type { Channel } from "pusher-js";
import type {
    NotificationCreatedPayload,
    NotificationReadPayload,
    RealtimeConfig,
    RealtimeConnectionState,
} from "./types";

export interface NotificationStreamHandlers {
    onCreated: (payload: NotificationCreatedPayload) => void;
    onRead: (payload: NotificationReadPayload) => void;
    /**
     * Fires on every successful (re)subscription — the moment to ask the server what
     * was missed, because the socket itself has no replay.
     */
    onSubscribed: () => void;
    onState?: (state: RealtimeConnectionState) => void;
}

interface Shared {
    id: string;
    userId: number;
    pusher: Pusher;
    channel: Channel;
    refs: number;
    disconnectTimer: ReturnType<typeof setTimeout> | null;
}

// Survives React StrictMode's mount/unmount/mount without reconnecting.
const DISCONNECT_GRACE_MS = 1500;

let shared: Shared | null = null;
let creating: { id: string; promise: Promise<Shared> } | null = null;

function connectionId(config: RealtimeConfig, userId: number): string {
    return [config.key, config.host, config.port, config.scheme, userId].join("|");
}

async function createShared(
    config: RealtimeConfig,
    userId: number,
    id: string,
): Promise<Shared> {
    const mod = await import("pusher-js");
    const PusherCtor = (mod as unknown as { default?: typeof Pusher }).default ?? (mod as unknown as typeof Pusher);

    const pusher = new PusherCtor(config.key, {
        cluster: "mt1", // required by the client, ignored once wsHost is set
        wsHost: config.host,
        wsPort: config.port,
        wssPort: config.port,
        forceTLS: config.scheme === "https",
        enabledTransports: ["ws", "wss"],
        disableStats: true,
        channelAuthorization: {
            transport: "ajax",
            endpoint: config.authEndpoint,
            customHandler: ({ socketId, channelName }, callback) => {
                axios
                    .post(config.authEndpoint, {
                        socket_id: socketId,
                        channel_name: channelName,
                    })
                    .then((response) => callback(null, response.data))
                    .catch((error) => callback(error, null));
            },
        },
    });

    const channel = pusher.subscribe(`private-notifications.${userId}`);

    return { id, userId, pusher, channel, refs: 0, disconnectTimer: null };
}

function teardown(connection: Shared): void {
    if (connection.disconnectTimer) clearTimeout(connection.disconnectTimer);
    try {
        connection.pusher.unsubscribe(`private-notifications.${connection.userId}`);
        connection.pusher.disconnect();
    } catch {
        // Already closed.
    }
    if (shared === connection) shared = null;
}

async function acquire(config: RealtimeConfig, userId: number): Promise<Shared> {
    const id = connectionId(config, userId);

    if (shared && shared.id !== id) teardown(shared);

    if (shared) {
        if (shared.disconnectTimer) {
            clearTimeout(shared.disconnectTimer);
            shared.disconnectTimer = null;
        }
        return shared;
    }

    if (!creating || creating.id !== id) {
        creating = { id, promise: createShared(config, userId, id) };
    }

    const pending = creating;
    const connection = await pending.promise;
    if (creating === pending) creating = null;

    if (shared && shared !== connection) {
        // Another acquire for the same id finished first.
        return shared;
    }
    shared = connection;
    return connection;
}

/**
 * Subscribes to one user's notification channel. Returns the cleanup function;
 * the connection itself is closed shortly after the last subscriber is gone.
 */
export function subscribeUserNotifications(
    config: RealtimeConfig,
    userId: number,
    handlers: NotificationStreamHandlers,
): () => void {
    let cancelled = false;
    let release: (() => void) | null = null;

    void acquire(config, userId)
        .then((connection) => {
            if (cancelled) {
                if (connection.refs === 0 && !connection.disconnectTimer) {
                    connection.disconnectTimer = setTimeout(
                        () => teardown(connection),
                        DISCONNECT_GRACE_MS,
                    );
                }
                return;
            }

            connection.refs += 1;

            const onCreated = (data: NotificationCreatedPayload) => handlers.onCreated(data);
            const onRead = (data: NotificationReadPayload) => handlers.onRead(data);
            const onSubscribed = () => handlers.onSubscribed();
            const onState = ({ current }: { current: RealtimeConnectionState }) =>
                handlers.onState?.(current);

            connection.channel.bind("notification.created", onCreated);
            connection.channel.bind("notification.read", onRead);
            connection.channel.bind("pusher:subscription_succeeded", onSubscribed);
            connection.pusher.connection.bind("state_change", onState);

            handlers.onState?.(connection.pusher.connection.state as RealtimeConnectionState);
            // Already subscribed (a second subscriber, or a StrictMode remount): gap-fill now.
            if (connection.channel.subscribed) handlers.onSubscribed();

            release = () => {
                connection.channel.unbind("notification.created", onCreated);
                connection.channel.unbind("notification.read", onRead);
                connection.channel.unbind("pusher:subscription_succeeded", onSubscribed);
                connection.pusher.connection.unbind("state_change", onState);

                connection.refs -= 1;
                if (connection.refs <= 0) {
                    connection.disconnectTimer = setTimeout(
                        () => teardown(connection),
                        DISCONNECT_GRACE_MS,
                    );
                }
            };
        })
        .catch(() => {
            // The socket library could not load or connect: callers fall back to the
            // slow catch-up timer via the "unavailable" state they never receive.
            handlers.onState?.("unavailable");
        });

    return () => {
        cancelled = true;
        release?.();
        release = null;
    };
}
