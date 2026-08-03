import type { ProductTourLabels, TourStep } from "@/Components/ProductTour/types";
import type { WorkspaceTabId } from "../types";

/**
 * Lead View Redesign guide — mirrors the Deals ProductTour consumer.
 * Copy lives under `pages.leads.tour` in resources/lang/{locale}/pages.php.
 */
export const LEAD_TOUR_ID = "lead-redesign-v1";

export const LEAD_TOUR_LABELS: ProductTourLabels = {
    next: "pages.leads.tour.next",
    back: "pages.leads.tour.back",
    done: "pages.leads.tour.done",
    skip: "pages.leads.tour.skip",
};

const STEP_KEY = (step: string, field: "title" | "body") =>
    `pages.leads.tour.steps.${step}.${field}`;

/**
 * Steps that need a tab pane (Overview, Lead info) call `onEnter` so the
 * target exists before ProductTour looks it up. Feature-gated regions
 * (AI summary, lifecycle banner) are omitted from the DOM when off — the
 * tour engine auto-skips missing targets.
 */
export function buildLeadTourSteps(
    setTab: (tab: WorkspaceTabId) => void,
): TourStep[] {
    return [
        {
            target: '[data-tour="lead-sticky-header"]',
            title: STEP_KEY("sticky_header", "title"),
            body: STEP_KEY("sticky_header", "body"),
        },
        {
            target: '[data-tour="lead-status-dropdown"]',
            title: STEP_KEY("status_dropdown", "title"),
            body: STEP_KEY("status_dropdown", "body"),
        },
        {
            target: '[data-tour="lead-lifecycle-banner"]',
            title: STEP_KEY("lifecycle_banner", "title"),
            body: STEP_KEY("lifecycle_banner", "body"),
        },
        {
            target: '[data-tour="lead-ai-summary"]',
            title: STEP_KEY("ai_summary", "title"),
            body: STEP_KEY("ai_summary", "body"),
        },
        {
            target: '[data-tour="lead-quick-stats"]',
            title: STEP_KEY("quick_stats", "title"),
            body: STEP_KEY("quick_stats", "body"),
        },
        {
            target: '[data-tour="lead-tabs"]',
            title: STEP_KEY("tabs", "title"),
            body: STEP_KEY("tabs", "body"),
        },
        {
            target: '[data-tour="lead-overview"]',
            title: STEP_KEY("overview", "title"),
            body: STEP_KEY("overview", "body"),
            onEnter: () => setTab("overview"),
        },
        {
            target: '[data-tour="lead-info-sidebar"]',
            title: STEP_KEY("lead_info", "title"),
            body: STEP_KEY("lead_info", "body"),
            placement: "right",
            onEnter: () => setTab("leadinfo"),
        },
        {
            target: "#lead-tab-deals",
            title: STEP_KEY("deals", "title"),
            body: STEP_KEY("deals", "body"),
        },
        {
            target: "#lead-tab-files",
            title: STEP_KEY("files", "title"),
            body: STEP_KEY("files", "body"),
        },
        {
            target: "#lead-tab-timeline",
            title: STEP_KEY("timeline", "title"),
            body: STEP_KEY("timeline", "body"),
        },
        {
            target: '[data-tour="lead-quick-actions"]',
            title: STEP_KEY("quick_actions", "title"),
            body: STEP_KEY("quick_actions", "body"),
            placement: "left",
        },
        {
            target: '[data-tour="lead-dossier"]',
            title: STEP_KEY("dossier", "title"),
            body: STEP_KEY("dossier", "body"),
            placement: "left",
        },
        {
            target: '[data-tour="lead-actions-menu"]',
            title: STEP_KEY("actions_menu", "title"),
            body: STEP_KEY("actions_menu", "body"),
        },
        {
            title: STEP_KEY("closing", "title"),
            body: STEP_KEY("closing", "body"),
        },
    ];
}
