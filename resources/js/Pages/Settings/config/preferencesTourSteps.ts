import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Account Preferences guide. Copy lives under `pages.settings.preferences_tour`.
 * Notification bypass is omitted from the DOM when off — the engine auto-skips.
 */
export const PREFERENCES_TOUR_ID = "preferences-v1";

export const PREFERENCES_TOUR_LABELS: ProductTourLabels = {
    next: "pages.settings.preferences_tour.next",
    back: "pages.settings.preferences_tour.back",
    done: "pages.settings.preferences_tour.done",
    skip: "pages.settings.preferences_tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.settings.preferences_tour.steps.${step}.${field}`;

export function buildPreferencesTourSteps(): TourStep[] {
    return [
        {
            target: '[data-tour="preferences-timezone"]',
            title: STEP_KEY("timezone", "title"),
            body: STEP_KEY("timezone", "body"),
        },
        {
            target: '[data-tour="preferences-browser-sync"]',
            title: STEP_KEY("browser_sync", "title"),
            body: STEP_KEY("browser_sync", "body"),
        },
        {
            target: '[data-tour="preferences-in-app-alerts"]',
            title: STEP_KEY("in_app_alerts", "title"),
            body: STEP_KEY("in_app_alerts", "body"),
        },
        {
            target: '[data-tour="preferences-notifications"]',
            title: STEP_KEY("notifications", "title"),
            body: STEP_KEY("notifications", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
