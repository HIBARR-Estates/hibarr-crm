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
            return "Queues a Meta Conversion event";
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
};

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
