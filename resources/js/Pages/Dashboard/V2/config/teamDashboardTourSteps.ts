import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Team dashboard guide — copy under `pages.dashboard.tour.steps.team_*` in
 * resources/lang/{locale}/pages.php (same namespace as the personal tour chrome).
 */
export const TEAM_DASHBOARD_TOUR_ID = "team-dashboard-v1";

export const TEAM_DASHBOARD_TOUR_LABELS: ProductTourLabels = {
    next: "pages.dashboard.tour.next",
    back: "pages.dashboard.tour.back",
    done: "pages.dashboard.tour.done",
    skip: "pages.dashboard.tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.dashboard.tour.steps.${step}.${field}`;

export function buildTeamDashboardTourSteps(): TourStep[] {
    return [
        {
            target: '[data-tour="team-stat-tiles"]',
            title: STEP_KEY("team_stats", "title"),
            body: STEP_KEY("team_stats", "body"),
        },
        {
            target: '[data-tour="team-network"]',
            title: STEP_KEY("team_network", "title"),
            body: STEP_KEY("team_network", "body"),
        },
        {
            target: '[data-tour="team-charts"]',
            title: STEP_KEY("team_charts", "title"),
            body: STEP_KEY("team_charts", "body"),
        },
        {
            target: '[data-tour="team-recent-commissions"]',
            title: STEP_KEY("team_recent", "title"),
            body: STEP_KEY("team_recent", "body"),
            placement: "top",
        },
        {
            title: STEP_KEY("team_closing", "title"),
            body: STEP_KEY("team_closing", "body"),
        },
    ];
}
