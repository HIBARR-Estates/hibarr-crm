export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourStep {
    /**
     * CSS selector for the element to spotlight (e.g. `[data-tour="deal-tabs"]`
     * or an existing id like `#deal-tab-timeline`). Omit for a centered,
     * non-spotlighted step — used for a closing "you're ready" card.
     */
    target?: string;
    /** Translation key (resolved via `t()`), not raw copy — steps are static, pre-translated content. */
    title: string;
    /** Translation key (resolved via `t()`), not raw copy — steps are static, pre-translated content. */
    body: string;
    /** Defaults to whichever side has more room. */
    placement?: TourPlacement;
    /**
     * Runs when this step becomes active, before its target is looked up —
     * e.g. switch tabs so a tab-scoped target renders. The engine retries
     * the target lookup across a few frames to give this time to take effect.
     */
    onEnter?: () => void;
}

export interface ProductTourLabels {
    next: string;
    back: string;
    done: string;
    skip: string;
}

export interface ProductTourProps {
    /** Stable id for this tour's seen-state, e.g. "deal-redesign-v1". */
    tourId: string;
    steps: TourStep[];
    /** Translation keys for the tour's own Next/Back/Done/Skip chrome. */
    labels: ProductTourLabels;
}
