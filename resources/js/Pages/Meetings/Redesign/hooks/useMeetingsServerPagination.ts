import { useCallback, useEffect, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import type { PaginatedFollowupResponse } from "@/Types/api/deal-followup";
import { fetchMeetingsPage } from "../lib/fetchMeetingsPage";

interface UseMeetingsServerPaginationOptions {
    meetings: PaginatedFollowupResponse;
    /** Props a page navigation asks back for. */
    only: string[];
    /** Called when the reader pins a rows-per-page value. */
    onPersistPageSize?: (size: number) => void;
}

/**
 * The URL minus `page`/`per_page` — the part that actually distinguishes one
 * query from another (filters, tab, view). Paging alone changes `url` too
 * (it's a query param), so keying the cache on the raw URL would invalidate
 * every prefetched page the moment the reader moved to it.
 */
function scopeOf(url: string): string {
    const [path, query] = url.split("?");
    if (!query) return path;
    const params = new URLSearchParams(query);
    params.delete("page");
    params.delete("per_page");
    const rest = params.toString();
    return rest ? `${path}?${rest}` : path;
}

function cacheKeyFor(page: number, perPage: number, scope: string): string {
    return `${scope}|${page}|${perPage}`;
}

/**
 * Server-driven pagination with an in-memory page cache and a background
 * prefetch of the next page, so paging forward is instant.
 *
 * Same approach the tasks list uses: the next page is fetched as a partial
 * Inertia request while the current one is being read, and clicking "next"
 * paints from that cache immediately while the real visit catches up in the
 * background. The cache is keyed on the URL, so any change to the filters or
 * the tab drops it rather than serving rows from the previous query.
 */
export default function useMeetingsServerPagination({
    meetings,
    only,
    onPersistPageSize,
}: UseMeetingsServerPaginationOptions) {
    const { url, component, version } = usePage();
    const scope = scopeOf(url);
    const cacheRef = useRef(new Map<string, PaginatedFollowupResponse>());
    const prefetchingRef = useRef(new Set<string>());

    const [optimistic, setOptimistic] =
        useState<PaginatedFollowupResponse | null>(null);
    const [isPaging, setIsPaging] = useState(false);

    const display = optimistic ?? meetings;

    // Seed the cache whenever Inertia delivers a real page.
    useEffect(() => {
        cacheRef.current.set(
            cacheKeyFor(meetings.current_page, meetings.per_page, scope),
            meetings,
        );
        setOptimistic(null);
    }, [meetings, scope]);

    // Drop stale entries when the query string changes (filters, tab, view) —
    // but not on paging alone, or every prefetched page would be discarded
    // the instant the reader landed on it.
    useEffect(() => {
        cacheRef.current.clear();
        prefetchingRef.current.clear();
    }, [scope]);

    const prefetchPage = useCallback(
        async (targetPage: number, perPage: number) => {
            const key = cacheKeyFor(targetPage, perPage, scope);
            if (cacheRef.current.has(key) || prefetchingRef.current.has(key)) {
                return;
            }

            prefetchingRef.current.add(key);
            try {
                const payload = await fetchMeetingsPage(targetPage, perPage, {
                    version: version as string | null,
                    component,
                });
                cacheRef.current.set(key, payload);
            } catch {
                // Prefetch is best-effort — paging still works via Inertia.
            } finally {
                prefetchingRef.current.delete(key);
            }
        },
        [scope, component, version],
    );

    // Always stay one page ahead of what is on screen — but only once the
    // page has stopped moving, so the load sequence doesn't fetch a page that
    // a pending size correction is about to invalidate anyway.
    useEffect(() => {
        if (isPaging) return;
        const nextPage = display.current_page + 1;
        if (nextPage > display.last_page) return;

        const timer = window.setTimeout(
            () => void prefetchPage(nextPage, display.per_page),
            400,
        );
        return () => window.clearTimeout(timer);
    }, [
        isPaging,
        display.current_page,
        display.last_page,
        display.per_page,
        prefetchPage,
    ]);

    const visit = useCallback(
        (params: Record<string, string | number | null>) => {
            router.get(route("meetings.index"), mergeQueryParams(params), {
                only,
                preserveState: true,
                preserveScroll: true,
                onFinish: () => setIsPaging(false),
            });
        },
        [only],
    );

    const goToPage = useCallback(
        (page: number, perPage = display.per_page) => {
            const cached = cacheRef.current.get(
                cacheKeyFor(page, perPage, scope),
            );
            if (cached) setOptimistic(cached);
            else setIsPaging(true);

            visit({ page, per_page: perPage });
        },
        [display.per_page, scope, visit],
    );

    const changePageSize = useCallback(
        (size: number, options?: { silent?: boolean }) => {
            onPersistPageSize?.(size);
            cacheRef.current.clear();
            prefetchingRef.current.clear();
            // Drop any optimistic page too — otherwise `display` keeps
            // showing the previous page/per_page pairing (and prefetch keeps
            // targeting it) until the visit for the new size lands.
            setOptimistic(null);
            // A silent change is the page correcting its own length to the
            // window. Dimming for that reads as the page reloading itself
            // every time it is opened, which is what it looked like.
            if (!options?.silent) setIsPaging(true);
            visit({ page: null, per_page: size });
        },
        [onPersistPageSize, visit],
    );

    return { meetings: display, isPaging, goToPage, changePageSize };
}
