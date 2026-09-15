import { useEffect, useState } from "react";

const MAX_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_MINUTES = 30;

/**
 * Bumps when the soonest follow-up boundary passes — either a start (upcoming
 * → live) or an end (live → past) — so bucket flags can flip without a reload.
 */
export default function useMeetingClockTick(
    followUps: Array<{
        next_follow_up_date?: string | null;
        duration?: number | null;
        effective_duration?: number | null;
    }>,
): number {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const now = Date.now();
        const boundaries = followUps.flatMap((followUp) => {
            if (!followUp.next_follow_up_date) return [];
            const start = new Date(followUp.next_follow_up_date).getTime();
            if (Number.isNaN(start)) return [];
            const minutes =
                followUp.duration ??
                followUp.effective_duration ??
                DEFAULT_DURATION_MINUTES;
            const end = start + minutes * 60 * 1000;
            return [start, end];
        });

        const nextExpiry = boundaries
            .filter((time) => time > now)
            .reduce<number | undefined>(
                (soonest, time) =>
                    soonest === undefined || time < soonest ? time : soonest,
                undefined,
            );

        if (nextExpiry === undefined) return;

        const timeout = setTimeout(
            () => setTick((current) => current + 1),
            Math.min(nextExpiry - now + 1000, MAX_TIMEOUT_MS),
        );

        return () => clearTimeout(timeout);
    }, [followUps, tick]);

    return tick;
}
