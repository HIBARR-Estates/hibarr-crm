import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";

/**
 * Reminder preferences guide. Copy lives under
 * `pages.settings.reminder_preferences_tour`. Do not import preferences-v1
 * here — that tour belongs on the Preferences page only.
 */
export const REMINDER_PREFERENCES_TOUR_ID = "reminder-preferences-v1";

export const REMINDER_PREFERENCES_TOUR_LABELS: ProductTourLabels = {
    next: "pages.settings.reminder_preferences_tour.next",
    back: "pages.settings.reminder_preferences_tour.back",
    done: "pages.settings.reminder_preferences_tour.done",
    skip: "pages.settings.reminder_preferences_tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.settings.reminder_preferences_tour.steps.${step}.${field}`;

export function buildReminderPreferencesTourSteps(): TourStep[] {
    return [
        {
            target: '[data-tour="reminders-enable"]',
            title: STEP_KEY("enable", "title"),
            body: STEP_KEY("enable", "body"),
        },
        {
            target: '[data-tour="reminders-rows"]',
            title: STEP_KEY("rows", "title"),
            body: STEP_KEY("rows", "body"),
        },
        {
            target: '[data-tour="reminders-save-reset"]',
            title: STEP_KEY("save_reset", "title"),
            body: STEP_KEY("save_reset", "body"),
        },
        {
            target: '[data-tour="reminders-defaults"]',
            title: STEP_KEY("defaults", "title"),
            body: STEP_KEY("defaults", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
