import { router } from "@inertiajs/react";

/**
 * Rewrite the address bar without creating a history entry and without
 * dropping Inertia's page snapshot from the current one.
 *
 * `history.replaceState({}, ...)` wipes that snapshot; pressing back/forward
 * onto the entry then fails Inertia's `isValidState` check and it re-visits
 * the URL from scratch (which, on a page with deferred props, can push yet
 * more entries). Always carry `window.history.state` over.
 */
export function replaceUrlKeepingHistoryState(url: string | URL): void {
    if (typeof window === "undefined") return;
    window.history.replaceState(window.history.state, "", url.toString());
}

/**
 * Make same-page partial reloads (deferred prop groups, `router.reload({
 * only })`) replace the current history entry instead of pushing a new one.
 *
 * Inertia only replaces automatically when the response URL still matches
 * the address bar. A page that stamps view state into the query string with
 * `replaceUrlKeepingHistoryState` (e.g. `?tab=`) while such a reload is in
 * flight breaks that match, so every late-arriving deferred group pushed a
 * duplicate entry for the same record — the back button then needed several
 * clicks to leave it. The reload still writes its merged props into the
 * current entry, so back/forward restores a fully loaded page.
 *
 * Returns the unsubscribe function, for use as a `useEffect` cleanup.
 */
export function replaceHistoryOnPartialReloads(): () => void {
    return router.on("before", (event) => {
        const { visit } = event.detail;
        const isPartial = visit.only.length > 0 || visit.except.length > 0;
        if (visit.method !== "get" || !isPartial) return;
        if (visit.url.pathname !== window.location.pathname) return;
        visit.replace = true;
    });
}
