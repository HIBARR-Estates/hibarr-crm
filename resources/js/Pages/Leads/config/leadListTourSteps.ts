import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Leads index guide. Copy lives under `pages.leads.list_tour` — do not
 * reuse `pages.leads.tour` (that is the lead *detail* redesign tour).
 */
export const LEADS_LIST_TOUR_ID = "leads-list-v1";

export const LEADS_LIST_TOUR_LABELS: ProductTourLabels = {
    next: "pages.leads.list_tour.next",
    back: "pages.leads.list_tour.back",
    done: "pages.leads.list_tour.done",
    skip: "pages.leads.list_tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.leads.list_tour.steps.${step}.${field}`;

/**
 * Due this week and the filter sentence are omitted from the DOM when the
 * chip count is 0 / filter v2 is off — the engine auto-skips missing targets.
 */
export function buildLeadListTourSteps(): TourStep[] {
    return [
        {
            target: '[data-tour="leads-list-header"]',
            title: STEP_KEY("header", "title"),
            body: STEP_KEY("header", "body"),
        },
        {
            target: '[data-tour="leads-list-due-this-week"]',
            title: STEP_KEY("due_this_week", "title"),
            body: STEP_KEY("due_this_week", "body"),
        },
        {
            target: '[data-tour="leads-list-search"]',
            title: STEP_KEY("search", "title"),
            body: STEP_KEY("search", "body"),
        },
        {
            target: '[data-tour="leads-list-import"]',
            title: STEP_KEY("import", "title"),
            body: STEP_KEY("import", "body"),
        },
        {
            target: '[data-tour="leads-list-filters"]',
            title: STEP_KEY("filters", "title"),
            body: STEP_KEY("filters", "body"),
        },
        {
            target: '[data-tour="leads-list-add"]',
            title: STEP_KEY("add", "title"),
            body: STEP_KEY("add", "body"),
        },
        {
            target: '[data-tour="leads-list-filter-sentence"]',
            title: STEP_KEY("filter_sentence", "title"),
            body: STEP_KEY("filter_sentence", "body"),
        },
        {
            target: '[data-tour="leads-list-table"]',
            title: STEP_KEY("table", "title"),
            body: STEP_KEY("table", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
