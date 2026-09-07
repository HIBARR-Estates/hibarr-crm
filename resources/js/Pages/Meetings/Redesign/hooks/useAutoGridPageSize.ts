import { useCallback, useEffect, useRef, useState } from "react";

/** One arrangement the same page of records can be drawn in. */
export interface AutoGridLayout {
    /** Height of one row/card, excluding the gap below it. */
    itemHeight: number;
    /** Vertical gap between rows. */
    gap: number;
    /**
     * Widths at which the grid gains a column, mirroring the Tailwind
     * breakpoints the grid itself uses. A single-column list passes `[0]`.
     */
    columnBreakpoints: number[];
}

interface UseAutoGridPageSizeOptions {
    /** Off while the user has pinned an explicit rows-per-page. */
    enabled: boolean;
    /** Element the rows start at — its top edge is where the space begins. */
    anchorRef: React.RefObject<HTMLElement | null>;
    /**
     * Every layout the page can be switched into, not just the active one.
     *
     * The size is the *smallest* of them — the number that fits in all of
     * them at once. Two things fall out of that. One size across every layout
     * means switching cards ↔ list is pure rendering of records already in
     * hand, with no request behind it. And because it fits the tightest
     * layout, nothing ever runs past the fold, so the pager stays on screen
     * and changing page never means scrolling first.
     *
     * Sizing to the largest layout instead would do the opposite: it fills
     * the roomier arrangement and buries the pager in the tighter one.
     */
    layouts: AutoGridLayout[];
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
 * card on a laptop, no band of empty white on a tall monitor, and never a
 * pager you have to scroll to reach. It only ever returns a number — the
 * caller decides whether to ask the server for it.
 */
export default function useAutoGridPageSize({
    enabled,
    anchorRef,
    layouts,
    minRows = 1,
    minItems = 3,
    maxItems = 60,
}: UseAutoGridPageSizeOptions): number | null {
    const [pageSize, setPageSize] = useState<number | null>(null);

    // Read through a ref so a new array literal from the caller doesn't
    // re-subscribe the resize listener on every render.
    const layoutsRef = useRef(layouts);
    layoutsRef.current = layouts;

    const measure = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;

        const { width, top } = anchor.getBoundingClientRect();
        // The grid's own top, so a taller header (extra filter row, wrapped
        // toolbar) shortens the page rather than pushing rows off-screen.
        const available = window.innerHeight - top - FOOTER_RESERVE;

        const needed = layoutsRef.current.map((layout) => {
            const columns = Math.max(
                1,
                layout.columnBreakpoints.filter((min) => width >= min).length,
            );
            const rows = Math.max(
                minRows,
                Math.floor(
                    (available + layout.gap) / (layout.itemHeight + layout.gap),
                ),
            );

            return rows * columns;
        });

        // The tightest layout wins: a page that fits the worst case fits them
        // all, which is what keeps the pager above the fold everywhere.
        setPageSize(
            Math.max(minItems, Math.min(maxItems, Math.min(...needed))),
        );
    }, [anchorRef, maxItems, minItems, minRows]);

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
