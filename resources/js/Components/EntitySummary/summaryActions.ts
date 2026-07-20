import { router } from "@inertiajs/react";
import type {
    EntitySummaryActionType,
    EntitySummaryNextStep,
} from "@/Types/entity-summary";

/**
 * Actions the CRM cannot actually perform from the summary card. The model is
 * still allowed to *suggest* these (they're legitimate off-platform next steps
 * — send an email, escalate to a manager, chase missing info), but there is no
 * in-app feature that a button click could carry out, so we must NOT render a
 * clickable "do it" button that pretends otherwise. These render as advice
 * text only. NO_ACTION_NEEDED hides the footer entirely (handled separately).
 */
const ADVICE_ONLY_ACTIONS = new Set<EntitySummaryActionType>([
    "SEND_FOLLOWUP_EMAIL",
    "ESCALATE_TO_MANAGER",
    "REQUEST_MISSING_INFO",
    "NO_ACTION_NEEDED",
]);

/**
 * Whether a click on the next-step button maps to a real, in-app action.
 * ADVANCE_STAGE is only executable when the caller actually wired a stage
 * handler (i.e. the user can change stages) — otherwise it's a dead button.
 */
export function isExecutableAction(
    actionType: EntitySummaryActionType,
    opts?: { canAdvanceStage?: boolean },
): boolean {
    if (ADVICE_ONLY_ACTIONS.has(actionType)) return false;
    if (actionType === "ADVANCE_STAGE") return Boolean(opts?.canAdvanceStage);
    return true;
}

interface ExecuteSummaryActionOptions {
    nextStep: EntitySummaryNextStep;
    entityType: "lead" | "deal";
    entityId: number;
    leadPhone?: string | null;
    onQualifyLead?: () => void;
    onCreateTask?: () => void;
    onScheduleCall?: () => void;
    onRequestDocuments?: () => void;
    onAdvanceStage?: () => void;
    onReviewStaleDeal?: () => void;
}

export function executeSummaryAction({
    nextStep,
    entityType,
    entityId,
    leadPhone,
    onQualifyLead,
    onCreateTask,
    onScheduleCall,
    onRequestDocuments,
    onAdvanceStage,
    onReviewStaleDeal,
}: ExecuteSummaryActionOptions): void {
    const { action_type, target_deal_id } = nextStep;

    switch (action_type) {
        case "OPEN_DEAL":
            if (target_deal_id) {
                router.visit(route("deals.show", target_deal_id));
            }
            break;
        case "REVIEW_DEALS":
            if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=deals`);
            }
            break;
        case "CREATE_TASK":
            if (onCreateTask) {
                onCreateTask();
            } else if (entityType === "deal") {
                router.visit(`${route("deals.show", entityId)}?tab=workspace&subtab=tasks`);
            }
            break;
        case "CONTACT_LEAD":
        case "SCHEDULE_CALL":
            if (onScheduleCall) {
                onScheduleCall();
            } else if (leadPhone) {
                window.location.href = `tel:${leadPhone}`;
            } else if (onQualifyLead) {
                onQualifyLead();
            } else if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=qualification`);
            } else if (entityType === "deal") {
                router.visit(`${route("deals.show", entityId)}?tab=workspace&subtab=meetings`);
            }
            break;
        case "QUALIFY_LEAD":
            if (onQualifyLead) {
                onQualifyLead();
            } else if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=qualification`);
            }
            break;
        case "REQUEST_DOCUMENTS":
            if (onRequestDocuments) {
                onRequestDocuments();
            } else if (entityType === "deal") {
                router.visit(`${route("deals.show", entityId)}?tab=workspace&subtab=files`);
            }
            break;
        case "ADVANCE_STAGE":
            if (onAdvanceStage) {
                onAdvanceStage();
            }
            break;
        case "REVIEW_STALE_DEAL":
            if (onReviewStaleDeal) {
                onReviewStaleDeal();
            } else if (entityType === "deal") {
                router.visit(`${route("deals.show", entityId)}?tab=timeline`);
            }
            break;
        case "SEND_FOLLOWUP_EMAIL":
        case "REQUEST_MISSING_INFO":
        case "ESCALATE_TO_MANAGER":
            if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=notes`);
            } else if (entityType === "deal") {
                router.visit(`${route("deals.show", entityId)}?tab=workspace&subtab=notes`);
            }
            break;
        case "NO_ACTION_NEEDED":
        default:
            break;
    }
}

/**
 * Button labels for EXECUTABLE actions only — each describes what the click
 * actually does in-app, not what the human should ultimately achieve. Advice-
 * only actions never reach here (no button is rendered for them).
 */
export function nextStepButtonLabel(nextStep: EntitySummaryNextStep): string {
    switch (nextStep.action_type) {
        case "OPEN_DEAL":
            return "Open deal";
        case "REVIEW_DEALS":
            return "Review deals";
        case "CREATE_TASK":
            return "Create task";
        case "SCHEDULE_CALL":
        case "CONTACT_LEAD":
            return "Schedule meeting";
        case "QUALIFY_LEAD":
            return "Open qualification";
        // The CRM can't SEND a document request; the honest in-app action is
        // reviewing which documents are on file / outstanding.
        case "REQUEST_DOCUMENTS":
            return "Review documents";
        case "ADVANCE_STAGE":
            return "Advance stage";
        case "REVIEW_STALE_DEAL":
            return "Review timeline";
        default:
            return nextStep.label;
    }
}
