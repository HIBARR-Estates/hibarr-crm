import { useCallback, useEffect } from "react";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";

interface UsePersistedPageSizeOptions {
    /** localStorage key — must be unique per page (e.g. "hibarr_deals_per_page"). */
    storageKey: string;
    /** per_page the server actually rendered this page with. */
    currentPerPage: number;
    /**
     * Called once on mount with the remembered preference — only when it's
     * set, differs from currentPerPage, and the URL doesn't already name a
     * per_page (an explicit link/bookmark wins over the stored value).
     * Wire it to the same reload the page already does for its own
     * onPageSizeChange, so page-specific params (filters, view mode, ...)
     * stay intact.
     */
    onRestore: (perPage: number) => void;
}

/**
 * Rows-per-page preference, remembered per browser *per page* — each
 * DataTable-backed index (Leads, Deals, Properties, ...) gets its own
 * storageKey, so picking 50 on one list doesn't change another's default.
 */
export default function usePersistedPageSize({
    storageKey,
    currentPerPage,
    onRestore,
}: UsePersistedPageSizeOptions) {
    useEffect(() => {
        if (getCurrentQueryParams().per_page) return;

        const stored = Number(localStorage.getItem(storageKey));
        if (!stored || stored === currentPerPage) return;

        onRestore(stored);
        // Mount-only: re-checking on every re-render would fight the user's
        // own subsequent page-size changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const persistPageSize = useCallback(
        (pageSize: number) => {
            localStorage.setItem(storageKey, String(pageSize));
        },
        [storageKey],
    );

    return { persistPageSize };
}
