import { CSSProperties } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { ActionType, LogChannel, LogStatus, TriggerKey } from "./types";

const ACTION_TYPE_ICON: Record<ActionType, string> = {
    stage_transition: "layers",
    set_field_value: "edit",
    lock_deal: "lock",
    send_email: "mail",
    create_task: "check-square",
    create_note: "file-text",
    meta_conversion: "target",
    wait: "clock",
};

export function actionTypeIcon(actionType: ActionType): string {
    return ACTION_TYPE_ICON[actionType] ?? "info";
}

/** Short generic description for an action row, keyed by its action_type. */
export function actionTypeSubtitle(actionType: ActionType): string {
    switch (actionType) {
        case "stage_transition":
            return "Moves the deal to a pipeline stage";
        case "set_field_value":
            return "Sets a field to a fixed value";
        case "lock_deal":
            return "Locks the deal from further edits";
        case "send_email":
            return "Sends an email from a template";
        case "create_task":
            return "Creates a task";
        case "create_note":
            return "Adds a note";
        case "meta_conversion":
            return "Sends a Meta Conversion event";
        case "wait":
            return "Pauses the flow before continuing";
        default:
            return "";
    }
}

const ACTION_TYPE_LABEL: Record<ActionType, string> = {
    stage_transition: "Move stage",
    set_field_value: "Set field value",
    lock_deal: "Lock deal",
    send_email: "Send email",
    create_task: "Create task",
    create_note: "Add note",
    meta_conversion: "Meta conversion",
    wait: "Wait",
};

/** English source string — wrap with td() at the render site. */
export function actionTypeLabel(actionType: ActionType): string {
    return ACTION_TYPE_LABEL[actionType] ?? actionType;
}

const TRIGGER_LABEL: Record<TriggerKey, string> = {
    deal_created: "Deal Created",
    deal_updated: "Deal Updated",
    followup_created: "Follow-up Created",
    custom_field_updated: "Custom Field Updated",
    lead_created: "Lead Created",
    lead_updated: "Lead Updated",
    lead_followup_created: "Lead Follow-up Created",
    date_based: "Specific Date / Birthday",
    lead_created_api: "Lead Created (via API)",
    lead_updated_api: "Lead Updated (via API)",
    deal_created_api: "Deal Created (via API)",
    deal_updated_api: "Deal Updated (via API)",
};

/** English source string — wrap with td() at the render site. */
export function triggerLabel(trigger: TriggerKey | null): string {
    return trigger ? (TRIGGER_LABEL[trigger] ?? trigger) : "No trigger";
}

/** Which automation subject_type(s) each trigger applies to — matches the
 * data-subject gating in deal-automation/edit.blade.php's #trigger select. */
export const TRIGGER_SUBJECT: Record<TriggerKey, "deal" | "lead" | "any"> = {
    deal_created: "deal",
    deal_updated: "deal",
    followup_created: "deal",
    custom_field_updated: "any",
    lead_created: "lead",
    lead_updated: "lead",
    lead_followup_created: "lead",
    date_based: "any",
    lead_created_api: "lead",
    lead_updated_api: "lead",
    deal_created_api: "deal",
    deal_updated_api: "deal",
};

const TRIGGER_ICON: Record<TriggerKey, string> = {
    deal_created: "zap",
    deal_updated: "edit",
    followup_created: "calendar",
    custom_field_updated: "layers",
    lead_created: "zap",
    lead_updated: "edit",
    lead_followup_created: "calendar",
    date_based: "clock",
    lead_created_api: "zap",
    lead_updated_api: "edit",
    deal_created_api: "zap",
    deal_updated_api: "edit",
};

/** Plain-language explanation of exactly what fires each trigger, rendered
 * under the trigger selector in the automation builder. The "via API" ones
 * exist because the API-token-authenticated write endpoints
 * (DealContactApiController, DealCreationService) persist with
 * saveQuietly() — the normal (non-API) triggers below never see those
 * writes at all, regardless of anything an automation's conditions check. */
const TRIGGER_EXPLANATION: Record<TriggerKey, string> = {
    deal_created: "Fires when a deal is created from inside the CRM — the New Deal form, deal gathering flow, or a lead being converted to a deal. Does not fire for deals created via the external API.",
    deal_updated: "Fires when a deal is edited from inside the CRM — the deal detail page, table quick-edit, stage moves, or another automation's own action. Does not fire for deals updated via the external API.",
    followup_created: "Fires when a follow-up is added to a deal.",
    custom_field_updated: "Fires when a custom field value changes on the deal or lead.",
    lead_created: "Fires when a lead is created from inside the CRM — the New Lead form, an import, or the public lead-capture form. Does not fire for leads created via the external API (unless the API call was made with notify enabled).",
    lead_updated: "Fires when a lead is edited from inside the CRM — the lead detail page or the table's inline quick-edit pickers (status, temperature, owner, etc). Does not fire for leads updated via the external API (unless the API call was made with notify enabled).",
    lead_followup_created: "Fires when a follow-up is added to a lead.",
    date_based: "Fires once a day for every lead/deal whose configured date field matches today (e.g. a birthday or an anniversary), regardless of how or when that record was created or last updated.",
    lead_created_api: "Fires whenever an external system creates a new lead through the CRM's API (contact/create or deal/create) — this is the only reliable trigger for API-originated leads, since those API writes normally bypass the regular \"Lead Created\" trigger above.",
    lead_updated_api: "Fires whenever an external system updates an existing lead's details through the CRM's API (contact/create or deal/create) — this is the only reliable trigger for API-originated lead edits, since those API writes normally bypass the regular \"Lead Updated\" trigger above.",
    deal_created_api: "Fires whenever an external system creates a new deal through the CRM's API (deal/create) — this is the only reliable trigger for API-originated deals, since those API writes normally bypass the regular \"Deal Created\" trigger above.",
    deal_updated_api: "Fires whenever an external system updates an existing deal through the CRM's API (deal/create with an existing lead_id) — this is the only reliable trigger for API-originated deal edits, since those API writes normally bypass the regular \"Deal Updated\" trigger above.",
};

/** English source string — wrap with td() at the render site. Null (no
 * trigger picked yet) returns "" so callers can skip rendering the hint. */
export function triggerExplanation(trigger: TriggerKey | null): string {
    return trigger ? (TRIGGER_EXPLANATION[trigger] ?? "") : "";
}

export function triggerIcon(trigger: TriggerKey | null): string {
    return trigger ? (TRIGGER_ICON[trigger] ?? "zap") : "zap";
}

const CHANNEL_ICON: Record<LogChannel, string> = {
    stage: "layers",
    field: "edit",
    lock: "lock",
    email: "mail",
    task: "check-square",
    note: "file-text",
    meta: "target",
    wait: "clock",
};

export function channelIcon(channel: LogChannel | null): string {
    return channel ? (CHANNEL_ICON[channel] ?? "info") : "info";
}

export type PillVariant = "blue" | "green" | "amber" | "red" | "gray" | "teal" | "navy";

export function statusToVariant(status: LogStatus): PillVariant {
    if (status === "success") return "green";
    if (status === "failed") return "red";
    return "gray";
}

/**
 * Background/color for the round channel-icon avatar in activity feeds.
 * Deliberately not the same palette as the status pill next to it: only
 * success (green) and failed (red) get a tinted avatar, skipped stays neutral.
 */
export function statusIconWrap(status: LogStatus): CSSProperties {
    if (status === "success") return { background: T.BLUE_LIGHT, color: T.BLUE_DARK };
    if (status === "failed") return { background: T.RED_SOFT, color: T.RED };
    return { background: T.GRAY, color: T.GRAY_DARK };
}

/** "5 minutes" / "1 day" / "Runs immediately" — real config, not a computed average. */
export function formatWaitConfig(
    value: number | null,
    unit: string | null,
    labels: { immediate: string; unitLabel: (unit: string) => string },
): string {
    if (!value) return labels.immediate;
    return `${value} ${labels.unitLabel(unit ?? "days")}`;
}
