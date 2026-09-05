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

function cacheKeyFor(page: number, perPage: number, url: string): string {
    return `${url}|${page}|${perPage}`;
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
    const cacheRef = useRef(new Map<string, PaginatedFollowupResponse>());
    const prefetchingRef = useRef(new Set<string>());

    const [optimistic, setOptimistic] =
        useState<PaginatedFollowupResponse | null>(null);
    const [isPaging, setIsPaging] = useState(false);

    const display = optimistic ?? meetings;

    // Seed the cache whenever Inertia delivers a real page.
    useEffect(() => {
        cacheRef.current.set(
            cacheKeyFor(meetings.current_page, meetings.per_page, url),
            meetings,
        );
        setOptimistic(null);
    }, [meetings, url]);

    // Drop stale entries when the query string changes (filters, tab, view).
    useEffect(() => {
        cacheRef.current.clear();
        prefetchingRef.current.clear();
    }, [url]);

    const prefetchPage = useCallback(
        async (targetPage: number, perPage: number) => {
            const key = cacheKeyFor(targetPage, perPage, url);
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
        [url, component, version],
    );

    // Always stay one page ahead of what is on screen.
    useEffect(() => {
        const nextPage = display.current_page + 1;
        if (nextPage > display.last_page) return;
        void prefetchPage(nextPage, display.per_page);
    }, [
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
                cacheKeyFor(page, perPage, url),
            );
            if (cached) setOptimistic(cached);
            else setIsPaging(true);

            visit({ page, per_page: perPage });
        },
        [display.per_page, url, visit],
    );

    const changePageSize = useCallback(
        (size: number) => {
            onPersistPageSize?.(size);
            cacheRef.current.clear();
            prefetchingRef.current.clear();
            setIsPaging(true);
            visit({ page: null, per_page: size });
        },
        [onPersistPageSize, visit],
    );

    return { meetings: display, isPaging, goToPage, changePageSize };
}
