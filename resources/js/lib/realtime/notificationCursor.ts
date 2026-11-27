/**
 * Where this tab is in a user's notification stream, kept in sessionStorage so it
 * survives full page loads (Open/action buttons navigate with window.location).
 *
 * Two things live here, and neither decides what is "new" — the server does
 * (a socket event, or `since` answering with rows newer than the cursor):
 *
 * - the cursor: created_at of the newest notification this tab has handled, the
 *   starting point for gap-fill after a reload or reconnect;
 * - the applied ids: because delivery is at-least-once (the catch-up window
 *   deliberately overlaps by a few seconds, and a socket event can race it), this
 *   keeps the same notification from alerting twice.
 */

const MAX_APPLIED_IDS = 200;

export interface NotificationCursorStore {
    getCursor(): string | null;
    /** Moves the cursor forward only. */
    advance(isoTimestamp: string | null | undefined): void;
    hasApplied(id: string): boolean;
    markApplied(id: string): void;
}

function safeStorage(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

export function createNotificationCursorStore(
    userId: number,
): NotificationCursorStore {
    const cursorKey = `notification_stream_cursor_${userId}`;
    const appliedKey = `notification_stream_applied_${userId}`;
    const storage = safeStorage();

    let cursor: string | null = null;
    let applied: string[] = [];

    try {
        cursor = storage?.getItem(cursorKey) ?? null;
        const raw = storage?.getItem(appliedKey);
        const parsed = raw ? JSON.parse(raw) : [];
        applied = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        // Unreadable storage: start clean, memory still dedupes within this page.
    }

    const appliedSet = new Set(applied);

    const persistApplied = () => {
        try {
            storage?.setItem(appliedKey, JSON.stringify(applied));
        } catch {
            // Storage full/blocked: the in-memory set still covers this page load.
        }
    };

    return {
        getCursor: () => cursor,

        advance(isoTimestamp) {
            if (!isoTimestamp) return;
            const next = Date.parse(isoTimestamp);
            if (Number.isNaN(next)) return;
            if (cursor !== null && Date.parse(cursor) >= next) return;
            cursor = isoTimestamp;
            try {
                storage?.setItem(cursorKey, cursor);
            } catch {
                // See persistApplied.
            }
        },

        hasApplied: (id) => appliedSet.has(id),

        markApplied(id) {
            if (appliedSet.has(id)) return;
            appliedSet.add(id);
            applied.push(id);
            if (applied.length > MAX_APPLIED_IDS) {
                const dropped = applied.splice(0, applied.length - MAX_APPLIED_IDS);
                dropped.forEach((old) => appliedSet.delete(old));
            }
            persistApplied();
        },
    };
}
