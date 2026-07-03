import { router } from "@inertiajs/react";
import type { EntitySummaryNextStep } from "@/Types/entity-summary";

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

export function nextStepButtonLabel(nextStep: EntitySummaryNextStep): string {
    switch (nextStep.action_type) {
        case "OPEN_DEAL":
            return "Open deal";
        case "REVIEW_DEALS":
            return "Review deals";
        case "CREATE_TASK":
            return "Create task";
        case "REQUEST_DOCUMENTS":
            return "Request documents";
        case "ADVANCE_STAGE":
            return "Advance stage";
        case "REVIEW_STALE_DEAL":
            return "Review deal";
        default:
            return nextStep.label;
    }
}
