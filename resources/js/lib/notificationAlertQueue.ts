/**
 * The backlog policy for popup alerts, kept pure so it can be tested without React.
 *
 * Alerts that arrive while one is on screen wait in a queue. When the card on
 * screen finishes, this decides what comes next:
 *
 *  1. an urgent alert (a meeting that can be joined now) always goes first and is
 *     never folded into a summary;
 *  2. a backlog longer than `collapseAfter` is replaced by one "N new
 *     notifications" card, so a burst (or a reconnect catch-up) cannot make the
 *     user sit through a dozen cards back to back;
 *  3. otherwise the oldest waiting alert, first in first out.
 */

export type QueueDecision<T> =
    | { kind: "empty" }
    | { kind: "show"; alert: T; rest: T[] }
    | { kind: "collapse"; count: number };

export function decideNextAlert<T extends { urgent?: boolean }>(
    waiting: readonly T[],
    collapseAfter: number,
): QueueDecision<T> {
    if (waiting.length === 0) return { kind: "empty" };

    const urgentIndex = waiting.findIndex((alert) => alert.urgent);
    if (urgentIndex >= 0) {
        return {
            kind: "show",
            alert: waiting[urgentIndex],
            rest: waiting.filter((_, index) => index !== urgentIndex),
        };
    }

    if (waiting.length > collapseAfter) {
        return { kind: "collapse", count: waiting.length };
    }

    return { kind: "show", alert: waiting[0], rest: waiting.slice(1) };
}
