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
 * Make same-page reloads (deferred prop groups, `router.reload()` with or
 * without `only`) replace the current history entry instead of pushing one.
 *
 * Inertia only replaces automatically when the response URL still matches
 * the address bar. A page that stamps view state into the query string with
 * `replaceUrlKeepingHistoryState` (e.g. `?tab=`) breaks that match, so every
 * reload (late deferred groups, note/follow-up/file mutations calling
 * `router.reload()`) pushed a duplicate entry for the same record — the back
 * button then needed several clicks to leave it. The reload still writes its
 * props into the current entry, so back/forward restores a loaded page.
 *
 * Registered once globally from the Inertia entry (see inertia.tsx), so
 * every page — redesign or legacy — gets it. Link clicks and cross-page
 * visits (different pathname, no preserveState) are untouched.
 *
 * Returns the unsubscribe function.
 */
export function replaceHistoryOnSamePageReloads(): () => void {
    return router.on("before", (event) => {
        const { visit } = event.detail;
        if (visit.method !== "get") return;
        if (visit.url.pathname !== window.location.pathname) return;
        const isPartial = visit.only.length > 0 || visit.except.length > 0;
        if (!isPartial && !visit.preserveState) return;
        visit.replace = true;
    });
}

const BACK_KEY_PREFIX = "crm.backTo:";

let skipNextBackRecord = false;

function backKey(pathname: string): string {
    return `${BACK_KEY_PREFIX}${pathname}`;
}

/**
 * Remember where the user came from (path + full query string) whenever they
 * navigate to a different page, keyed by the destination pathname. This is
 * what lets a detail page's Back button return to a filtered list with its
 * query params intact. Stored in sessionStorage so it survives a reload of
 * the detail page; failures are ignored (private mode, storage blocked).
 *
 * Returns the unsubscribe function.
 */
export function trackBackTargets(): () => void {
    return router.on("before", (event) => {
        const { visit } = event.detail;
        // A Back navigation must not rewrite the destination's own return
        // target, or list → lead → deal → Back → Back would bounce between
        // the two detail pages instead of reaching the list.
        if (skipNextBackRecord) {
            skipNextBackRecord = false;
            return;
        }
        // Prefetches fire `before` too but are not navigations.
        if (visit.method !== "get" || visit.prefetch) return;
        if (visit.url.pathname === window.location.pathname) return;
        try {
            window.sessionStorage.setItem(
                backKey(visit.url.pathname),
                window.location.pathname + window.location.search,
            );
        } catch {
            /* storage unavailable — Back falls back to the index route */
        }
    });
}

/** URL (path + query) the current page was reached from, if known. */
export function getBackTarget(pathname: string = window.location.pathname): string | null {
    try {
        const value = window.sessionStorage.getItem(backKey(pathname));
        // Same-origin relative paths only.
        return value && value.startsWith("/") && !value.startsWith("//")
            ? value
            : null;
    } catch {
        return null;
    }
}

/**
 * Visit the recorded origin of the current page (or `fallbackHref`) without
 * recording this visit as a new origin for the page it lands on.
 */
export function visitBackTarget(fallbackHref: string): void {
    skipNextBackRecord = true;
    router.visit(getBackTarget() ?? fallbackHref, {
        // Reset if Inertia cancels the visit before `before` consumed it.
        onCancel: () => {
            skipNextBackRecord = false;
        },
    });
}
