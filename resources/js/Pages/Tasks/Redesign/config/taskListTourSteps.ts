import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";
import type { TasksViewMode } from "../components/TasksHeader";

/**
 * Tasks list (workspace redesign) guide. Copy lives under `pages.tasks.tour`
 * in resources/lang/{locale}/pages.php.
 */
export const TASKS_LIST_TOUR_ID = "tasks-list-v1";

export const TASKS_LIST_TOUR_LABELS: ProductTourLabels = {
    next: "pages.tasks.tour.next",
    back: "pages.tasks.tour.back",
    done: "pages.tasks.tour.done",
    skip: "pages.tasks.tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.tasks.tour.steps.${step}.${field}`;

/**
 * Group by only renders in List — `onEnter` switches the view before the
 * engine looks up that target. Add task / Task settings are omitted from
 * the DOM when the user cannot see them; the engine auto-skips.
 */
export function buildTaskListTourSteps(
    setView: (view: TasksViewMode) => void,
): TourStep[] {
    return [
        {
            target: '[data-tour="tasks-list-header"]',
            title: STEP_KEY("header", "title"),
            body: STEP_KEY("header", "body"),
        },
        {
            target: '[data-tour="tasks-list-view-toggle"]',
            title: STEP_KEY("view_toggle", "title"),
            body: STEP_KEY("view_toggle", "body"),
        },
        {
            target: '[data-tour="tasks-list-add"]',
            title: STEP_KEY("add", "title"),
            body: STEP_KEY("add", "body"),
        },
        {
            target: '[data-tour="tasks-list-settings"]',
            title: STEP_KEY("settings", "title"),
            body: STEP_KEY("settings", "body"),
        },
        {
            target: '[data-tour="tasks-list-quick-filters"]',
            title: STEP_KEY("quick_filters", "title"),
            body: STEP_KEY("quick_filters", "body"),
        },
        {
            target: '[data-tour="tasks-list-group-by"]',
            title: STEP_KEY("group_by", "title"),
            body: STEP_KEY("group_by", "body"),
            onEnter: () => setView("list"),
        },
        {
            target: '[data-tour="tasks-list-filters"]',
            title: STEP_KEY("filters", "title"),
            body: STEP_KEY("filters", "body"),
        },
        {
            target: '[data-tour="tasks-list-filter-sentence"]',
            title: STEP_KEY("filter_sentence", "title"),
            body: STEP_KEY("filter_sentence", "body"),
        },
        {
            target: '[data-tour="tasks-list-search"]',
            title: STEP_KEY("search", "title"),
            body: STEP_KEY("search", "body"),
        },
        {
            target: '[data-tour="tasks-list-body"]',
            title: STEP_KEY("body", "title"),
            body: STEP_KEY("body", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
