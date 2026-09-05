import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoGridPageSizeOptions {
    /** Off while the user has pinned an explicit rows-per-page. */
    enabled: boolean;
    /** Element the rows start at — its top edge is where the space begins. */
    anchorRef: React.RefObject<HTMLElement | null>;
    /** Height of one row/card, excluding the gap below it. */
    itemHeight: number;
    /** Vertical gap between rows. */
    gap: number;
    /**
     * Widths at which the grid gains a column, mirroring the Tailwind
     * breakpoints the grid itself uses. A single-column list passes `[0]`.
     */
    columnBreakpoints: number[];
    /** Never ask for fewer than this many rows, however short the window. */
    minRows?: number;
    /**
     * Floor and ceiling the server also enforces. They have to match: the
     * server clamps `per_page` silently, so asking for a value outside its
     * range means the page never arrives at the size it asked for and the
     * caller re-requests it on every render.
     */
    minItems?: number;
    maxItems?: number;
}

/** Space kept below the grid for the pagination bar and the page's bottom padding. */
const FOOTER_RESERVE = 132;

/**
 * How many cards/rows actually fit between the top of the grid and the bottom
 * of the window, as a page size.
 *
 * The point is that a page ends where the window does: no half-visible last
 * card on a laptop, no band of empty white on a tall monitor. It only ever
 * returns a number — the caller decides whether to ask the server for it.
 */
export default function useAutoGridPageSize({
    enabled,
    anchorRef,
    itemHeight,
    gap,
    columnBreakpoints,
    minRows = 1,
    minItems = 3,
    maxItems = 60,
}: UseAutoGridPageSizeOptions): number | null {
    const [pageSize, setPageSize] = useState<number | null>(null);

    // Read through a ref so a new array literal from the caller doesn't
    // re-subscribe the resize listener on every render.
    const breakpointsRef = useRef(columnBreakpoints);
    breakpointsRef.current = columnBreakpoints;

    const measure = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;

        const width = anchor.getBoundingClientRect().width;
        const columns = Math.max(
            1,
            breakpointsRef.current.filter((min) => width >= min).length,
        );

        // The grid's own top, so a taller header (extra filter row, wrapped
        // toolbar) shortens the page rather than pushing rows off-screen.
        const top = anchor.getBoundingClientRect().top;
        const available = window.innerHeight - top - FOOTER_RESERVE;
        const rows = Math.max(
            minRows,
            Math.floor((available + gap) / (itemHeight + gap)),
        );

        setPageSize(Math.max(minItems, Math.min(maxItems, rows * columns)));
    }, [anchorRef, gap, itemHeight, maxItems, minItems, minRows]);

    useEffect(() => {
        if (!enabled) {
            setPageSize(null);
            return undefined;
        }

        measure();

        // Debounced: a drag-resize fires continuously, and each distinct size
        // this settles on costs a request.
        let timer: number | undefined;
        const onResize = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(measure, 200);
        };

        window.addEventListener("resize", onResize);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("resize", onResize);
        };
    }, [enabled, measure]);

    return pageSize;
}
