import { useEffect, useState } from "react";

/**
 * The current time, refreshed on each minute boundary, so time states
 * ("in 12 min", "now", "late") move on their own without a reload.
 */
export default function useMinuteClock(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timeout = window.setTimeout(() => setNow(Date.now()), 60_000 - (now % 60_000) + 50);
        return () => window.clearTimeout(timeout);
    }, [now]);

    return now;
}
