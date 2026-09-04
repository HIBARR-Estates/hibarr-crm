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
    const name = criterion.reference_field?.label ?? "field";
    const op = OPERATOR_LABELS[criterion.operator] ?? criterion.operator;
    const needsValue = criterion.operator !== "exists" && criterion.operator !== "boolean";
    const base = needsValue ? `${name} ${op} “${criterion.reference_value}”` : `${name} ${op}`;
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
