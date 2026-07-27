import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";
import type { DealTab } from "../types";

/**
 * Deals Redesign guide — the reference consumer of the shared ProductTour
 * engine (resources/js/Components/ProductTour/). `title`/`body` are real
 * translation keys (resolved via `t()`), not raw strings — copy lives
 * statically in resources/lang/*\/pages.php under `deals.tour`, in every
 * supported language, rather than being machine-translated at render time.
 */
export const DEAL_TOUR_ID = "deal-redesign-v1";

export const DEAL_TOUR_LABELS: ProductTourLabels = {
    next: "pages.deals.tour.next",
    back: "pages.deals.tour.back",
    done: "pages.deals.tour.done",
    skip: "pages.deals.tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.deals.tour.steps.${step}.${field}`;

/**
 * A couple of steps (Overview, Deal info) point at content that only renders
 * once its tab is active — `onEnter` switches the tab before the target
 * lookup runs. Built as a function (not a static export) because it needs
 * `nav.setTab`, which only exists inside the page component.
 */
export function buildDealTourSteps(setTab: (tab: DealTab) => void): TourStep[] {
    return [
        {
            target: '[data-tour="deal-sticky-header"]',
            title: STEP_KEY("sticky_header", "title"),
            body: STEP_KEY("sticky_header", "body"),
        },
        {
            target: '[data-tour="deal-value"]',
            title: STEP_KEY("deal_value", "title"),
            body: STEP_KEY("deal_value", "body"),
        },
        {
            target: '[data-tour="deal-pipeline-stepper"]',
            title: STEP_KEY("pipeline_stepper", "title"),
            body: STEP_KEY("pipeline_stepper", "body"),
        },
        {
            target: '[data-tour="deal-stage-requirements"]',
            title: STEP_KEY("stage_requirements", "title"),
            body: STEP_KEY("stage_requirements", "body"),
        },
        {
            target: '[data-tour="deal-stage-progression"]',
            title: STEP_KEY("stage_progression", "title"),
            body: STEP_KEY("stage_progression", "body"),
        },
        {
            target: '[data-tour="deal-ai-summary"]',
            title: STEP_KEY("ai_summary", "title"),
            body: STEP_KEY("ai_summary", "body"),
        },
        {
            target: '[data-tour="deal-tabs"]',
            title: STEP_KEY("tabs", "title"),
            body: STEP_KEY("tabs", "body"),
        },
        {
            target: '[data-tour="deal-overview"]',
            title: STEP_KEY("overview", "title"),
            body: STEP_KEY("overview", "body"),
            onEnter: () => setTab("overview"),
        },
        {
            target: '[data-tour="deal-info-sidebar"]',
            title: STEP_KEY("deal_info", "title"),
            body: STEP_KEY("deal_info", "body"),
            placement: "right",
            onEnter: () => setTab("dealinfo"),
        },
        {
            target: "#deal-tab-timeline",
            title: STEP_KEY("timeline", "title"),
            body: STEP_KEY("timeline", "body"),
        },
        {
            target: '[data-tour="deal-dossier"]',
            title: STEP_KEY("dossier", "title"),
            body: STEP_KEY("dossier", "body"),
            placement: "left",
        },
        {
            target: '[data-tour="deal-actions-menu"]',
            title: STEP_KEY("actions_menu", "title"),
            body: STEP_KEY("actions_menu", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
