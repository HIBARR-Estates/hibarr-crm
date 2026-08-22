import { useCallback, useEffect, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import {
    fetchTableTasksPage,
    type TableTasksPayload,
} from "../lib/fetchTableTasksPage";

interface UseTasksServerPaginationOptions {
    tableTasks: TableTasksPayload;
    /** Called when the user picks a new rows-per-page value. */
    onPersistPageSize?: (size: number) => void;
}

function cacheKeyFor(page: number, perPage: number, search: string): string {
    return `${search}|${page}|${perPage}`;
}

/**
 * Server-driven list pagination with an in-memory page cache and background
 * prefetch of the next page so forward navigation feels instant.
 */
export default function useTasksServerPagination({
    tableTasks,
    onPersistPageSize,
}: UseTasksServerPaginationOptions) {
    const { url, component, version } = usePage();
    const cacheRef = useRef(new Map<string, TableTasksPayload>());
    const prefetchingRef = useRef(new Set<string>());

    const [optimistic, setOptimistic] = useState<TableTasksPayload | null>(
        null,
    );
    const [isPaging, setIsPaging] = useState(false);

    const display = optimistic ?? tableTasks;

    // Seed cache whenever Inertia delivers a fresh page.
    useEffect(() => {
        const key = cacheKeyFor(
            tableTasks.current_page,
            tableTasks.per_page,
            url,
        );
        cacheRef.current.set(key, tableTasks);
        setOptimistic(null);
    }, [tableTasks, url]);

    // Drop stale entries when filters / quick pills change the query string.
    useEffect(() => {
        cacheRef.current.clear();
        prefetchingRef.current.clear();
    }, [url]);

    const prefetchPage = useCallback(
        async (targetPage: number, perPage: number) => {
            const key = cacheKeyFor(targetPage, perPage, url);
            if (
                cacheRef.current.has(key) ||
                prefetchingRef.current.has(key)
            ) {
                return;
            }

            prefetchingRef.current.add(key);
            try {
                const payload = await fetchTableTasksPage(
                    targetPage,
                    perPage,
                    { version: version as string | null, component },
                );
                cacheRef.current.set(key, payload);
            } catch {
                // Prefetch is best-effort — navigation still works via Inertia.
            } finally {
                prefetchingRef.current.delete(key);
            }
        },
        [url, component, version],
    );

    // Always stay one page ahead of the current view.
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

    const navigate = useCallback(
        (page: number, perPage = display.per_page) => {
            const key = cacheKeyFor(page, perPage, url);
            const cached = cacheRef.current.get(key);
            if (cached) {
                setOptimistic(cached);
            } else {
                setIsPaging(true);
            }

            router.get(
                route("tasks.index"),
                mergeQueryParams({ page, per_page: perPage }),
                {
                    only: ["tableTasks"],
                    preserveState: true,
                    preserveScroll: true,
                    onFinish: () => setIsPaging(false),
                },
            );
        },
        [display.per_page, url],
    );

    const changePageSize = useCallback(
        (size: number) => {
            onPersistPageSize?.(size);
            cacheRef.current.clear();
            prefetchingRef.current.clear();

            setIsPaging(true);
            router.get(
                route("tasks.index"),
                mergeQueryParams({ page: 1, per_page: size }),
                {
                    only: ["tableTasks"],
                    preserveState: true,
                    preserveScroll: true,
                    onFinish: () => setIsPaging(false),
                },
            );
        },
        [onPersistPageSize],
    );

    return {
        tableTasks: display,
        isPaging,
        navigateToPage: navigate,
        changePageSize,
    };
}
