import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Personal Dashboard guide — orients a first-time user around every panel on
 * the page. Copy lives under `pages.dashboard.tour`, in every supported
 * language, not machine-translated at render time (same rule as the deal and
 * lead tours).
 */
export const PERSONAL_DASHBOARD_TOUR_ID = "personal-dashboard-v1";

export const PERSONAL_DASHBOARD_TOUR_LABELS: ProductTourLabels = {
    next: "pages.dashboard.tour.next",
    back: "pages.dashboard.tour.back",
    done: "pages.dashboard.tour.done",
    skip: "pages.dashboard.tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.dashboard.tour.steps.${step}.${field}`;

export function buildPersonalDashboardTourSteps(): TourStep[] {
    return [
        {
            target: '[data-tour="dashboard-status-line"]',
            title: STEP_KEY("status_line", "title"),
            body: STEP_KEY("status_line", "body"),
        },
        {
            target: '[data-tour="dashboard-stat-strip"]',
            title: STEP_KEY("stat_strip", "title"),
            body: STEP_KEY("stat_strip", "body"),
        },
        {
            target: '[data-tour="dashboard-queue-panel"]',
            title: STEP_KEY("queue_panel", "title"),
            body: STEP_KEY("queue_panel", "body"),
        },
        {
            target: '[data-tour="dashboard-agenda"]',
            title: STEP_KEY("agenda", "title"),
            body: STEP_KEY("agenda", "body"),
            placement: "left",
        },
        {
            target: '[data-tour="dashboard-pipeline-panel"]',
            title: STEP_KEY("pipeline_panel", "title"),
            body: STEP_KEY("pipeline_panel", "body"),
            placement: "left",
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
