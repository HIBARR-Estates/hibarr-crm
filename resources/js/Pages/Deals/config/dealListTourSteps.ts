import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Deals index guide. Copy lives under `pages.deals.list_tour` — do not
 * reuse `pages.deals.tour` (that is the deal *detail* redesign tour).
 */
export const DEALS_LIST_TOUR_ID = "deals-list-v1";

export const DEALS_LIST_TOUR_LABELS: ProductTourLabels = {
    next: "pages.deals.list_tour.next",
    back: "pages.deals.list_tour.back",
    done: "pages.deals.list_tour.done",
    skip: "pages.deals.list_tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.deals.list_tour.steps.${step}.${field}`;

/**
 * Table and board are mutually exclusive. The table step calls `setView("table")`
 * (local preference only — not `handleViewChange`, which would Inertia-reload
 * mid-tour) so the target exists after a board-first visit.
 */
export function buildDealListTourSteps(
    setView: (view: "table" | "kanban") => void,
): TourStep[] {
    return [
        {
            target: '[data-tour="deals-list-header"]',
            title: STEP_KEY("header", "title"),
            body: STEP_KEY("header", "body"),
        },
        {
            target: '[data-tour="deals-list-view-toggle"]',
            title: STEP_KEY("view_toggle", "title"),
            body: STEP_KEY("view_toggle", "body"),
        },
        {
            target: '[data-tour="deals-list-pipeline"]',
            title: STEP_KEY("pipeline", "title"),
            body: STEP_KEY("pipeline", "body"),
        },
        {
            target: '[data-tour="deals-list-filters"]',
            title: STEP_KEY("filters", "title"),
            body: STEP_KEY("filters", "body"),
        },
        {
            target: '[data-tour="deals-list-search"]',
            title: STEP_KEY("search", "title"),
            body: STEP_KEY("search", "body"),
        },
        {
            target: '[data-tour="deals-list-actions"]',
            title: STEP_KEY("actions", "title"),
            body: STEP_KEY("actions", "body"),
        },
        {
            target: '[data-tour="deals-list-filter-sentence"]',
            title: STEP_KEY("filter_sentence", "title"),
            body: STEP_KEY("filter_sentence", "body"),
        },
        {
            target: '[data-tour="deals-list-table"]',
            title: STEP_KEY("table", "title"),
            body: STEP_KEY("table", "body"),
            onEnter: () => setView("table"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
