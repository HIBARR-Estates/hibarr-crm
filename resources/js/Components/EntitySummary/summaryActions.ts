import { router } from "@inertiajs/react";
import type { EntitySummaryNextStep } from "@/Types/entity-summary";

interface ExecuteSummaryActionOptions {
    nextStep: EntitySummaryNextStep;
    entityType: "lead" | "deal";
    entityId: number;
    leadPhone?: string | null;
    onQualifyLead?: () => void;
}

export function executeSummaryAction({
    nextStep,
    entityType,
    entityId,
    leadPhone,
    onQualifyLead,
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
        case "CONTACT_LEAD":
        case "SCHEDULE_CALL":
            if (leadPhone) {
                window.location.href = `tel:${leadPhone}`;
            } else if (onQualifyLead) {
                onQualifyLead();
            } else if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=qualification`);
            }
            break;
        case "QUALIFY_LEAD":
            if (onQualifyLead) {
                onQualifyLead();
            } else if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=qualification`);
            }
            break;
        case "SEND_FOLLOWUP_EMAIL":
        case "REQUEST_MISSING_INFO":
        case "ESCALATE_TO_MANAGER":
            if (entityType === "lead") {
                router.visit(`${route("lead-contact.show", entityId)}?tab=notes`);
            }
            break;
        case "NO_ACTION_NEEDED":
        default:
            break;
    }
}
