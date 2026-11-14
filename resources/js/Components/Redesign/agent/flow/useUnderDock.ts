import { useLayoutEffect } from "react";

/**
 * While a flow is open under the agent dock: bring the dock back into view
 * (the panel is pinned just under it) and keep the page behind from
 * scrolling. Off, it does nothing, so the classic pages are unchanged.
 * A layout effect, so the scroll happens before the first paint and the
 * panel never shows a frame at the old offset.
 */
export default function useUnderDock(active: boolean): void {
    useLayoutEffect(() => {
        if (!active) return;
        window.scrollTo({ top: 0 });
        const body = document.body;
        const previous = body.style.overflow;
        body.style.overflow = "hidden";
        return () => {
            body.style.overflow = previous;
        };
    }, [active]);
}

/** Class for the overlay: under the dock, or centred as on the classic pages. */
export function flowOverlayClass(underDock: boolean): string {
    return underDock ? "analysis-modal-overlay agent-flow-overlay" : "analysis-modal-overlay";
}
