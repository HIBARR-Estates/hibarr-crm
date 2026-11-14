import { useEffect, useMemo, useState } from "react";

/**
 * Format milliseconds into MM:SS string.
 */
export function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Hook to tick once a second while call is connected; null before that.
 */
export function useElapsed(connectedAt: number | null): string | null {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (connectedAt === null) {
            return;
        }
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [connectedAt]);

    return useMemo(() => {
        if (connectedAt === null) {
            return null;
        }
        return formatDuration(now - connectedAt);
    }, [connectedAt, now]);
}

/**
 * Up to two uppercase initials for the avatar bubble.
 */
export function initialsOf(name: string | null | undefined, fallback: string): string {
    const source = name?.trim() ? name.trim() : (fallback ?? "");
    return (
        source
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "·"
    );
}
