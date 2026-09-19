import { CustomField, ShowCriterion, ShowRuleGroup, ShowRuleSet } from "@/Types";
import { SettingsField } from "../types";

const OPERATOR_LABELS: Record<string, string> = {
    equals: "is",
    exists: "is not empty",
    boolean: "is true",
    ">": "is greater than",
    "<": "is less than",
    ">=": "is at least",
    "<=": "is at most",
    in: "is one of",
    not_in: "is not one of",
};

function criterionText(criterion: ShowCriterion): string {
    const source = criterion.reference_source ?? "custom_field";
    const name =
        source === "pipeline"
            ? "Pipeline"
            : source === "pipeline_stage"
              ? "Pipeline stage"
              : source === "deal_package"
                ? "Package"
                : source === "record"
                  ? "Record"
                  : (criterion.reference_field?.label ?? "field");
    const op = OPERATOR_LABELS[criterion.operator] ?? criterion.operator;
    const needsValue = criterion.operator !== "exists" && criterion.operator !== "boolean";
    const raw = criterion.reference_value;
    let display = raw ?? "";
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) display = parsed.join(", ");
        } catch {
            /* keep raw */
        }
    }
    const base = needsValue ? `${name} ${op} “${display}”` : `${name} ${op}`;
    return criterion.negate ? `not (${base})` : base;
}

function groupText(group: ShowRuleGroup): string {
    const parts = (group.criteria ?? []).map(criterionText);
    if (parts.length === 0) return "";
    const joiner = group.group_operator === "OR" ? " or " : " and ";
    const text = parts.join(joiner);
    return group.visibility_action === "hide" ? `NOT (${text})` : text;
}

/** Human summary for the Visibility rules tab, e.g. "Shown when Financing is Mortgage". */
export function ruleSummary(field: SettingsField): string {
    const rs = field.show_rule_set;
    if (!rs) return "";
    const groups = rs.groups?.length ? rs.groups : rs.group ? [rs.group] : [];
    const texts = groups.map(groupText).filter(Boolean);
    if (texts.length === 0) return "";
    if (texts.length === 1) return texts[0];
    const joiner = (rs.groups_operator ?? "AND") === "OR" ? " or " : " and ";
    return texts.join(joiner);
}

/**
 * `getRuleSet`'s happy path (a saved single-group rule) returns the row only
 * under `groups[0]`, not the back-compat `group` key that CustomFieldRuleBuilder
 * reads from — normalize that here so the builder actually shows the saved rule.
 */
export function normalizeRuleSet(ruleSet: ShowRuleSet | null | undefined): ShowRuleSet | null {
    if (!ruleSet) return null;
    if (ruleSet.group) return ruleSet;
    if (ruleSet.groups?.length) return { ...ruleSet, group: ruleSet.groups[0] };
    return ruleSet;
}

/** Parses a criterion's reference_value into an id list — a single scalar id ("4"), or a JSON array ("[4,7]") for `in`/`not_in`. */
function parseIdList(raw: unknown): number[] {
    if (raw === null || raw === undefined || raw === "") return [];
    if (typeof raw === "string" && raw.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map(Number).filter((n) => Number.isFinite(n));
            }
        } catch {
            /* fall through to scalar parse */
        }
    }
    const n = Number(raw);
    return Number.isFinite(n) ? [n] : [];
}

/**
 * The pipeline ids a field's FIRST `pipeline`-sourced criterion targets — for
 * the simplified "Show for pipeline(s)" picker on a Lead FILE field, which
 * only ever manages a single such criterion. Field rules built any other
 * way (the generic rule builder, several groups, a mix of sources) aren't
 * representable by that picker and come back empty here; opening the field
 * in the picker and saving would then replace the rule with a plain
 * pipeline-only one, which is why the picker only appears for a field whose
 * rule already matches this exact shape (see FieldModal's isSimplePipelineRule).
 */
export function extractPipelineIds(ruleSet: ShowRuleSet | null | undefined): number[] {
    const groups = ruleSet?.groups?.length ? ruleSet.groups : ruleSet?.group ? [ruleSet.group] : [];
    for (const group of groups) {
        for (const criterion of group.criteria ?? []) {
            if (criterion.reference_source === "pipeline") {
                return parseIdList(criterion.reference_value);
            }
        }
    }
    return [];
}

/**
 * Whether a field's rule set is empty, or is exactly the single
 * pipeline-only criterion shape the "Show for pipeline(s)" picker manages —
 * i.e. safe for that picker to take over without silently discarding a rule
 * built some other way (multiple groups/criteria, a non-pipeline source, a
 * hide action, OR logic, negation).
 */
export function isSimplePipelineRule(ruleSet: ShowRuleSet | null | undefined): boolean {
    if (!ruleSet || !ruleSet.enabled) return true;
    const groups = ruleSet.groups?.length ? ruleSet.groups : ruleSet.group ? [ruleSet.group] : [];
    if (groups.length === 0) return true;
    if (groups.length > 1) return false;
    const group = groups[0];
    if ((group.visibility_action ?? "show") !== "show") return false;
    const criteria = group.criteria ?? [];
    if (criteria.length === 0) return true;
    if (criteria.length > 1) return false;
    const criterion = criteria[0];
    return (
        criterion.reference_source === "pipeline" &&
        !criterion.negate &&
        (criterion.operator === "equals" || criterion.operator === "in")
    );
}

/**
 * The rule_set payload for `custom-fields.save-rule-set` that shows a field
 * exactly when the deal's pipeline is one of `pipelineIds` — what the
 * simplified "Show for pipeline(s)" picker on a Lead FILE field manages.
 * Empty `pipelineIds` disables the rule (field always shows), matching
 * Index.tsx's handleRemoveRule.
 */
export function buildPipelineRuleSetPayload(pipelineIds: number[]): Record<string, unknown> {
    if (pipelineIds.length === 0) {
        return { enabled: false, default_visibility: true, group: { group_operator: "AND", criteria: [] } };
    }

    return {
        enabled: true,
        default_visibility: false,
        groups: [
            {
                group_operator: "OR",
                enabled: true,
                visibility_action: "show",
                criteria: [
                    {
                        reference_source: "pipeline",
                        operator: pipelineIds.length > 1 ? "in" : "equals",
                        reference_value:
                            pipelineIds.length > 1 ? JSON.stringify(pipelineIds) : String(pipelineIds[0]),
                        negate: false,
                    },
                ],
            },
        ],
    };
}

/**
 * CustomFieldRuleBuilder was built against the legacy `@/Types` CustomField
 * shape (show_table/field_display_name/field_order). Adapt our settings-page
 * field into that shape rather than forking the component.
 */
export function toRuleBuilderField(field: SettingsField): CustomField {
    return {
        id: field.id,
        label: field.label,
        name: field.name,
        type: field.type,
        required: field.required,
        values: field.values.length ? JSON.stringify(field.values) : null,
        custom_field_group_id: field.custom_field_group_id,
        show_table: field.visible ? "true" : "false",
        field_display_name: field.label,
        field_order: field.display_order,
        display_order: field.display_order,
    };
}
