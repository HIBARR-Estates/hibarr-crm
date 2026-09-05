import {
    CONDITION_OPERATORS,
    DEAL_SETTABLE_FIELDS,
    conditionFieldGroups,
    conditionValueOptions,
    fieldValueOptions,
} from "../config/builderFields";
import {
    Automation,
    AutomationCatalog,
    CatalogUser,
    DealAutomationAction,
    DealAutomationCondition,
    SubjectType,
} from "../types";

/**
 * Plain-English renderings of a saved automation's conditions and actions.
 *
 * The builder screens already know how to *offer* every field/operator/value
 * — these functions reuse exactly those lists (config/builderFields.ts plus
 * the server catalog) to read a stored row back, so a label can never drift
 * from the picker that produced it.
 *
 * All strings here are English source strings, wrapped with td() at the
 * render site like the rest of config/.
 */

export interface ConditionSummary {
    /** "Lead Temperature" */
    field: string;
    /** "Equals" */
    operator: string;
    /** "Hot" — null for operators that take no value (Exists / Changed). */
    value: string | null;
}

export interface ActionSummary {
    /** "Send email" — the action type's own name. */
    label: string;
    /** What this specific action is configured to do, one clause per line. */
    lines: string[];
}

function userName(user: CatalogUser | undefined): string | null {
    if (!user) return null;
    return user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
}

/** value => label over every field the condition picker offers. */
function conditionFieldLabels(subjectType: SubjectType, catalog: AutomationCatalog): Record<string, string> {
    const labels: Record<string, string> = {};

    for (const group of conditionFieldGroups(subjectType, catalog)) {
        for (const option of group.options) {
            labels[option.value] = option.label;
        }
    }

    return labels;
}

/** Operators that compare against nothing — the stored value is meaningless. */
const VALUELESS_OPERATORS = new Set(["exists", "changed"]);

export function describeCondition(
    condition: DealAutomationCondition,
    subjectType: SubjectType,
    catalog: AutomationCatalog | null,
): ConditionSummary {
    const operator = CONDITION_OPERATORS.find((op) => op.value === condition.operator)?.label ?? condition.operator;

    if (!catalog) {
        return { field: condition.field, operator, value: condition.value == null ? null : String(condition.value) };
    }

    const field = conditionFieldLabels(subjectType, catalog)[condition.field] ?? condition.field;

    if (VALUELESS_OPERATORS.has(condition.operator)) {
        return { field, operator, value: null };
    }

    const raw = condition.value == null || condition.value === "" ? null : String(condition.value);
    if (raw === null) {
        return { field, operator, value: null };
    }

    // pipeline_stage_id isn't in conditionValueOptions() — it needs the
    // automation's own pipeline scope there, but for read-back any stage with
    // a matching id is the right name.
    if (condition.field === "pipeline_stage_id") {
        return { field, operator, value: catalog.stages.find((s) => String(s.id) === raw)?.name ?? raw };
    }

    const options = conditionValueOptions(condition.field, catalog);

    return { field, operator, value: options?.find((o) => o.value === raw)?.label ?? raw };
}

function describeStageTransition(action: DealAutomationAction, catalog: AutomationCatalog | null): string[] {
    const lines: string[] = [];

    const stage = action.targetStage?.name
        ?? catalog?.stages.find((s) => s.id === action.target_stage_id)?.name;
    lines.push(stage ? `Moves the deal to the "${stage}" stage` : "Moves the deal to another stage");

    const pipeline = catalog?.pipelines.find((p) => p.id === action.target_pipeline_id)?.name;
    if (pipeline) {
        lines.push(`Into the "${pipeline}" pipeline`);
    }

    if (action.forward_only) {
        lines.push("Only moves forward — never back to an earlier stage");
    }

    return lines;
}

function describeSetFieldValue(action: DealAutomationAction, catalog: AutomationCatalog | null): string[] {
    if (!action.field_name) {
        return ["No field chosen yet"];
    }

    const label = DEAL_SETTABLE_FIELDS[action.field_name]
        ?? catalog?.leadSettableFields?.[action.field_name]
        ?? action.field_name;

    const value = action.field_value ?? "";
    const valueLabel = fieldValueOptions(action.field_name)?.find((o) => o.value === value)?.label ?? value;

    return [valueLabel === "" ? `Clears "${label}"` : `Sets "${label}" to "${valueLabel}"`];
}

function describeSendEmail(action: DealAutomationAction, catalog: AutomationCatalog | null): string[] {
    const lines: string[] = [];

    lines.push(
        action.emailTemplate?.name
            ? `Sends the "${action.emailTemplate.name}" email template`
            : "Sends an email — no template chosen yet",
    );

    // Matches DealAutomationService::resolveEmailRecipients(), which falls back
    // to ['client'] when nothing is stored.
    const types = action.recipient_types?.length ? action.recipient_types : ["client"];
    const recipientLabels = types.map((type) => catalog?.recipientTypes?.[type]?.label ?? type);
    lines.push(`Recipients: ${recipientLabels.join(", ")}`);

    if (types.includes("specific_user") && action.recipient_user_ids?.length) {
        const names = action.recipient_user_ids
            .map((id) => userName(catalog?.users.find((u) => u.id === id)) ?? `#${id}`)
            .join(", ");
        lines.push(`Chosen users: ${names}`);
    }

    if (types.includes("custom_email") && action.recipient_emails) {
        lines.push(`Extra addresses: ${action.recipient_emails}`);
    }

    return lines;
}

function describeDueDate(action: DealAutomationAction, catalog: AutomationCatalog | null): string | null {
    if (action.due_date_delta_value === null || action.due_date_delta_value === undefined) {
        return action.due_time ? `Due at ${action.due_time}` : null;
    }

    const unit = catalog?.dueDateDeltaUnits?.[action.due_date_delta_unit ?? "days"]
        ?? action.due_date_delta_unit
        ?? "days";

    return `Due ${action.due_date_delta_value} ${unit} after it runs`
        + (action.due_time ? `, at ${action.due_time}` : "");
}

function describeAssignment(action: DealAutomationAction, catalog: AutomationCatalog | null): string | null {
    // Mirrors DealAutomationService::resolveAutomationUserId()'s default.
    const type = action.assignee_type ?? "lead_owner";

    if (type === "specific_user") {
        const name = userName(catalog?.users.find((u) => u.id === action.assignee_user_id));

        return `Assigned to ${name ?? `user #${action.assignee_user_id ?? "?"}`}`;
    }

    return `Assigned to ${catalog?.assignmentTypes?.[type] ?? type}`;
}

function describeCreateTask(action: DealAutomationAction, catalog: AutomationCatalog | null): string[] {
    const lines: string[] = [];

    lines.push(action.title ? `Creates the task "${action.title}"` : "Creates a task");

    const assignment = describeAssignment(action, catalog);
    if (assignment) lines.push(assignment);

    const due = describeDueDate(action, catalog);
    if (due) lines.push(due);

    return lines;
}

function describeCreateNote(action: DealAutomationAction): string[] {
    const lines: string[] = [];

    lines.push(action.title ? `Adds the note "${action.title}"` : "Adds a note");

    if (action.content) {
        lines.push(`Content: ${action.content}`);
    }

    return lines;
}

function describeMetaConversion(action: DealAutomationAction): string[] {
    const lines: string[] = [];

    lines.push(
        action.meta_event_name
            ? `Sends the "${action.meta_event_name}" conversion event to Meta`
            : "Sends a conversion event to Meta — no event name set yet",
    );

    if (action.meta_event_value) {
        lines.push(`Conversion value: ${action.meta_event_value}`);
    }

    return lines;
}

function describeWait(action: DealAutomationAction, catalog: AutomationCatalog | null): string[] {
    if (!action.wait_duration_value) {
        return ["No wait configured — the next step runs straight away"];
    }

    const unit = catalog?.waitDurationUnits?.[action.wait_duration_unit ?? "days"] ?? action.wait_duration_unit;

    return [`Pauses for ${action.wait_duration_value} ${unit}, then continues`];
}

/** English source strings — wrap each line with td() at the render site. */
export function describeAction(
    action: DealAutomationAction,
    catalog: AutomationCatalog | null,
): string[] {
    switch (action.action_type) {
        case "stage_transition":
            return describeStageTransition(action, catalog);
        case "set_field_value":
            return describeSetFieldValue(action, catalog);
        case "lock_deal":
            return ["Locks the deal so nobody can edit it further"];
        case "send_email":
            return describeSendEmail(action, catalog);
        case "create_task":
            return describeCreateTask(action, catalog);
        case "create_note":
            return describeCreateNote(action);
        case "meta_conversion":
            return describeMetaConversion(action);
        case "wait":
            return describeWait(action, catalog);
        default:
            return [];
    }
}

/**
 * "Runs every time it's triggered" vs "Only runs when all N checks pass" —
 * the AND logic matches DealAutomationService::evaluateConditions().
 */
export function describeConditionGate(automation: Automation): string {
    const count = automation.conditions.length;

    if (count === 0) {
        return "Runs every time the trigger fires — no conditions to meet";
    }

    return count === 1
        ? "Only runs when this is true"
        : `Only runs when all ${count} of these are true`;
}

/** Compact counterpart to describeConditionGate() for table rows. */
export function describeConditionCount(automation: Automation): string {
    const count = automation.conditions.length;

    if (count === 0) return "No conditions";

    return count === 1 ? "1 condition" : `${count} conditions`;
}

/**
 * "Runs immediately" / "Waits 2 days, then runs" — the automation-level wait
 * that happens before any action (distinct from a wait action step).
 */
export function describeAutomationWait(automation: Automation, catalog: AutomationCatalog | null): string {
    if (!automation.wait_duration_value) {
        return "Runs immediately";
    }

    const unit = catalog?.waitDurationUnits?.[automation.wait_duration_unit ?? "days"]
        ?? automation.wait_duration_unit;

    return `Waits ${automation.wait_duration_value} ${unit}, then runs`;
}
