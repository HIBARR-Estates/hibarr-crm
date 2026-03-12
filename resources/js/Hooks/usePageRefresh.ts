import { useState, useCallback, useRef } from "react";
import { App } from "antd";
import { router } from "@inertiajs/react";

interface UsePageRefreshOptions {
    /**
     * Custom refresh callback. When provided, this is called instead of a
     * plain `router.reload()`. Return a Promise to keep the loading indicator
     * alive until the async work completes.
     */
    onRefresh?: () => Promise<void> | void;

    /**
     * Optional guard — if it returns `false` the refresh is blocked
     * (useful when the user has unsaved inline edits).
     */
    canRefresh?: () => boolean;

    /**
     * Client-side debounce window in milliseconds (default: 2 000).
     */
    debounceMs?: number;
}

/**
 * Centralised hook that owns the refresh lifecycle for any page:
 *   • 2-second debounce to prevent API spam
 *   • Loading state tracking (works with both Inertia & React-Query)
 *   • Error handling via Ant Design message toast
 *   • Inline-edit collision guard
 */
export default function usePageRefresh({
    onRefresh,
    canRefresh,
    debounceMs = 2000,
}: UsePageRefreshOptions = {}) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const lastRefreshRef = useRef<number>(0);
    const { message } = App.useApp();

    const refresh = useCallback(async () => {
        // ── Debounce guard ──────────────────────────────────────────
        const now = Date.now();
        if (now - lastRefreshRef.current < debounceMs) return;

        // ── Collision guard (inline-edit check) ─────────────────────
        if (canRefresh && !canRefresh()) {
            message.warning(
                "Unsaved changes detected. Please save or discard before refreshing.",
            );
            return;
        }

        lastRefreshRef.current = now;
        setIsRefreshing(true);

        try {
            if (onRefresh) {
                // Custom refresh logic (React Query invalidation, etc.)
                await onRefresh();
            } else {
                // Default: Inertia partial reload — preserveState and
                // preserveScroll are implicit with router.reload().
                await new Promise<void>((resolve, reject) => {
                    router.reload({
                        onSuccess: () => resolve(),
                        onError: (errors) => reject(errors),
                    });
                });
            }
        } catch {
            message.error("Failed to refresh data. Please try again.");
        } finally {
            setIsRefreshing(false);
        }
    }, [onRefresh, canRefresh, debounceMs, message]);

    return { refresh, isRefreshing } as const;
}
