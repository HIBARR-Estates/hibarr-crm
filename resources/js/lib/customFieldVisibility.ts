import { CustomField, ShowRuleSet, ShowCriterion } from '@/Types';

// Type declaration for process (may not be available in browser)
declare const process: {
    env?: {
        NODE_ENV?: string;
    };
} | undefined;

/**
 * Deal context a rule set can be evaluated against, in addition to the
 * ordinary field-value map. `stages` resolves a `pipeline_stage` criterion's
 * ordering operators (>=, <=, ...) — stage ids are arbitrary, so ordering
 * only makes sense compared by `priority`.
 */
export interface VisibilityEvaluationContext {
    stages?: Array<{ id: number | string; priority: number }>;
}

function resolveStagePriority(
    stageId: unknown,
    stages: VisibilityEvaluationContext['stages']
): number | null {
    if (stageId === null || stageId === undefined || stageId === '') return null;
    const match = stages?.find((s) => String(s.id) === String(stageId));
    return match ? match.priority : null;
}

const ORDERING_OPERATORS = new Set(['>', '<', '>=', '<=']);

/**
 * An id-list criterion's `reference_value` can be a bare scalar ("11", for
 * `equals`) or a JSON array ("[11,12]" or ["11","12"]) for `in`/`not_in` —
 * and the array's elements can be numbers or strings depending on which UI
 * wrote them (the simplified pipeline picker serializes real numbers, the
 * generic rule builder's multi-selects serialize strings). `equals` already
 * coerces both sides through String() below, but `in`/`not_in` compares
 * array membership with strict equality — so without normalizing every
 * element to the same type here, a numeric id never matches a same-valued
 * string id. Leaves a bare scalar untouched.
 */
function normalizeIdListJson(raw: string): string {
    if (raw === null || raw === undefined || raw === '') return raw;
    const str = String(raw);
    if (str.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(str);
            if (Array.isArray(parsed)) {
                return JSON.stringify(parsed.map((v) => String(v)));
            }
        } catch {
            // fall through, leave as-is
        }
    }
    return str;
}

/**
 * Resolve the value a criterion compares against, reading from the source it
 * declares (a custom field's stored value by default, or a reserved deal
 * context key — see buildFieldValueMap). Ordering operators on a
 * `pipeline_stage` criterion compare stage *priority*, not the arbitrary id,
 * so both sides are resolved through `context.stages` first.
 */
function resolveCriterionValues(
    criterion: ShowCriterion,
    allFieldValues: Record<string, any>,
    context?: VisibilityEvaluationContext
): { fieldValue: any; referenceValue: string } {
    const source = criterion.reference_source ?? 'custom_field';
    let referenceValue = criterion.reference_value;

    let fieldValue: any;
    switch (source) {
        case 'pipeline':
            fieldValue = allFieldValues.pipeline;
            referenceValue = normalizeIdListJson(referenceValue);
            fieldValue = fieldValue == null ? fieldValue : String(fieldValue);
            break;
        case 'pipeline_stage':
            fieldValue = allFieldValues.pipeline_stage;
            if (ORDERING_OPERATORS.has(criterion.operator)) {
                const currentPriority = resolveStagePriority(fieldValue, context?.stages);
                const targetPriority = resolveStagePriority(referenceValue, context?.stages);
                fieldValue = currentPriority ?? '';
                referenceValue = targetPriority !== null ? String(targetPriority) : referenceValue;
            } else {
                referenceValue = normalizeIdListJson(referenceValue);
                fieldValue = fieldValue == null ? fieldValue : String(fieldValue);
            }
            break;
        case 'deal_package':
            fieldValue = allFieldValues.package;
            break;
        case 'record':
            fieldValue = allFieldValues.record;
            referenceValue = normalizeIdListJson(referenceValue);
            fieldValue = fieldValue == null ? fieldValue : String(fieldValue);
            break;
        case 'custom_field':
        default:
            fieldValue = allFieldValues[`field_${criterion.reference_field_id}`];
            break;
    }

    return { fieldValue, referenceValue };
}

/**
 * Evaluate a single criterion
 */
function evaluateCriterion(
    criterion: ShowCriterion,
    fieldValue: any,
    referenceValueOverride?: string
): boolean {
    const { operator, negate } = criterion;
    const reference_value = referenceValueOverride ?? criterion.reference_value;
    let result = false;

    switch (operator) {
        case 'equals':
            // Handle arrays (for checkbox fields) - check if the value is in the array
            if (Array.isArray(fieldValue)) {
                // Check if reference_value is in the array (case-insensitive, with trimming)
                // This matches PHP behavior: strtolower(trim((string)$val)) === strtolower(trim((string)$referenceValue))
                result = fieldValue.some(val => 
                    String(val).trim().toLowerCase() === String(reference_value).trim().toLowerCase()
                );
            } else {
                // Trim both values before comparison to match PHP behavior
                result = String(fieldValue).trim() === String(reference_value).trim();
            }
            break;

        case 'exists':
            // Handle arrays (for checkbox fields) - check if array has at least one element
            if (Array.isArray(fieldValue)) {
                result = fieldValue.length > 0;
            } else {
                // Check if value exists: not null, not undefined, and not empty string
                // Note: 0, false, and "0" are considered as existing values (user provided them)
                // This matches PHP behavior: $fieldValue !== null && $fieldValue !== ''
                result = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
            }
            break;

        case 'boolean':
            // Parse boolean value to match PHP's filter_var(..., FILTER_VALIDATE_BOOLEAN) behavior
            if (typeof fieldValue === 'boolean') {
                result = fieldValue;
            } else if (typeof fieldValue === 'number') {
                result = Boolean(fieldValue);
            } else if (typeof fieldValue === 'string') {
                const normalized = fieldValue.trim().toLowerCase();
                // PHP FILTER_VALIDATE_BOOLEAN returns true for: "1", "true", "on", "yes"
                // Returns false for: "0", "false", "off", "no", and any other value
                result = normalized === '1' || 
                         normalized === 'true' || 
                         normalized === 'on' || 
                         normalized === 'yes';
            } else {
                // For other types (null, undefined, objects, arrays), treat as false to match PHP
                result = false;
            }
            break;

        case '>':
            result = Number(fieldValue) > Number(reference_value);
            break;

        case '<':
            result = Number(fieldValue) < Number(reference_value);
            break;

        case '>=':
            result = Number(fieldValue) >= Number(reference_value);
            break;

        case '<=':
            result = Number(fieldValue) <= Number(reference_value);
            break;

        case 'in':
            try {
                const values = JSON.parse(reference_value);
                
                // Handle empty/null values array
                if (!Array.isArray(values) || values.length === 0) {
                    result = false;
                    break;
                }
                
                // Handle arrays (for checkbox fields) - check if any element exists in values
                if (Array.isArray(fieldValue)) {
                    result = fieldValue.some(val => values.includes(val));
                } else {
                    // Scalar value - use strict comparison
                    result = values.includes(fieldValue);
                }
            } catch {
                result = false;
            }
            break;

        case 'not_in':
            try {
                const values = JSON.parse(reference_value);
                
                // Handle empty/null values array
                if (!Array.isArray(values) || values.length === 0) {
                    result = true; // If no values to check against, field value is not in the list
                    break;
                }
                
                // Handle arrays (for checkbox fields) - return true only if none of the elements exist
                if (Array.isArray(fieldValue)) {
                    result = !fieldValue.some(val => values.includes(val));
                } else {
                    // Scalar value - use strict comparison
                    result = !values.includes(fieldValue);
                }
            } catch {
                result = false;
            }
            break;

        default:
            result = false;
    }

    return negate ? !result : result;
}

/**
 * Evaluate visibility for a single field
 */
export function evaluateFieldVisibility(
    field: CustomField,
    allFieldValues: Record<string, any>,
    context?: VisibilityEvaluationContext
): boolean {
    const ruleSet = field.show_rule_set;

    // If no rule set, field is visible by default
    if (!ruleSet) {
        return true;
    }
    
    // Create local constant for groups_operator (treat input as immutable)
    const groupsOperator = (ruleSet.groups_operator === 'OR' || ruleSet.groups_operator === 'AND')
        ? ruleSet.groups_operator
        : 'AND';

    // If rule set is disabled, use default visibility
    if (!ruleSet.enabled) {
        return ruleSet.default_visibility;
    }

    // Get groups (support both single group for backward compatibility and multiple groups)
    const groups = ruleSet.groups && ruleSet.groups.length > 0 
        ? ruleSet.groups 
        : (ruleSet.group ? [ruleSet.group] : []);

    // If no groups or all groups are empty, use default visibility
    if (groups.length === 0 || groups.every(g => !g.criteria || g.criteria.length === 0)) {
        return ruleSet.default_visibility;
    }

    const showGroupResults: boolean[] = [];
    const hideGroupResults: boolean[] = [];

    // Evaluate each group
    for (const group of groups) {
        // Skip disabled groups
        if (group.enabled === false) {
            continue;
        }
        
        if (!group.criteria || group.criteria.length === 0) {
            continue; // Skip empty groups
        }

        const criteriaResults: boolean[] = [];

        // Evaluate each criterion in the group
        for (const criterion of group.criteria) {
            const { fieldValue, referenceValue } = resolveCriterionValues(criterion, allFieldValues, context);
            const result = evaluateCriterion(criterion, fieldValue, referenceValue);
            criteriaResults.push(result);
        }

        // Combine criteria within group based on group_operator
        let groupResult: boolean;
        if (group.group_operator === 'OR') {
            // At least one criterion must pass (OR logic)
            // If any criterion is true, the group passes
            groupResult = criteriaResults.some(r => r === true);
        } else {
            // All criteria must pass (AND logic)
            groupResult = criteriaResults.length > 0 && criteriaResults.every(r => r === true);
        }

        // Separate groups by their visibility action
        const visibilityAction = group.visibility_action || 'show'; // Default to 'show' for backward compatibility
        if (visibilityAction === 'hide') {
            hideGroupResults.push(groupResult);
        } else {
            showGroupResults.push(groupResult);
        }
    }

    // Hide groups take absolute precedence - if ANY hide group matches, field is hidden
    // This is independent of the groups_operator - hide groups always work with OR logic
    // (if one group says hide, the field is hidden, regardless of other groups)
    if (hideGroupResults.length > 0 && hideGroupResults.some(r => r === true)) {
        return false; // Field is hidden if any hide group matches
    }

    // Otherwise, evaluate show groups
    let finalResult: boolean;
    if (showGroupResults.length === 0) {
        // No show groups, use default visibility
        finalResult = ruleSet.default_visibility;
    } else if (groupsOperator === 'OR') {
        // At least one show group must pass
        finalResult = showGroupResults.some(r => r === true);
    } else {
        // All show groups must pass (AND logic)
        finalResult = showGroupResults.every(r => r === true);
    }

    // NOTE: Exclusion conditions have been removed to allow full configurability through visibility rules.
    // If you need hardcoded exclusion logic, you can re-enable checkExclusionConditions() here.
    // For now, all visibility is controlled through the configurable rule system above.
    
    return finalResult;
}

/**
 * Check for exclusion conditions that force a field to be hidden
 * Returns false if exclusion condition is met (field should be hidden)
 * Returns true if no exclusion or exclusion not met (normal evaluation continues)
 */
function checkExclusionConditions(allFieldValues: Record<string, any>): boolean | null {
    // Check if "Residential" and "Immigration/Exit Plan" are both selected
    // IMPORTANT: Only apply exclusion if both values are in the SAME field
    // This prevents hiding fields when "Residential" is in "Purpose of Investment" 
    // and "Immigration/Exit Plan" is in a different field like "Residential" section
    
    for (const fieldKey in allFieldValues) {
        const fieldValue = allFieldValues[fieldKey];
        let hasResidential = false;
        let hasImmigrationExitPlan = false;
        
        // Handle checkbox arrays
        if (Array.isArray(fieldValue)) {
            // Check if THIS SPECIFIC FIELD contains both values
            for (const value of fieldValue) {
                const valueStr = String(value).toLowerCase().trim();
                if (valueStr.includes('residential') && !valueStr.includes('immigration')) {
                    // Check it's just "Residential", not "Residential" section options
                    hasResidential = true;
                }
                if (valueStr.includes('immigration') && valueStr.includes('exit')) {
                    hasImmigrationExitPlan = true;
                }
                // Also check for "Immigration/Exit Plan" as exact match
                if (valueStr.includes('immigration/exit plan') || 
                    valueStr.includes('immigration / exit plan')) {
                    hasImmigrationExitPlan = true;
                }
            }
        } else {
            // Handle string values (comma-separated checkbox values)
            const valueStr = String(fieldValue).toLowerCase().trim();
            if (valueStr.includes('residential') && !valueStr.includes('immigration')) {
                hasResidential = true;
            }
            if (valueStr.includes('immigration') && valueStr.includes('exit')) {
                hasImmigrationExitPlan = true;
            }
            if (valueStr.includes('immigration/exit plan') || 
                valueStr.includes('immigration / exit plan')) {
                hasImmigrationExitPlan = true;
            }
        }
        
        // Only apply exclusion if BOTH values are in the SAME field
        if (hasResidential && hasImmigrationExitPlan) {
            return false; // Force hide if both are in the same field
        }
    }

    // No exclusion condition met, continue with normal evaluation
    return true;
}

/**
 * Evaluate visibility for all fields
 * Returns a map: { 47: true, 48: false, ... }
 */
export function evaluateAllFieldsVisibility(
    fields: CustomField[],
    allFieldValues: Record<string, any>,
    context?: VisibilityEvaluationContext
): Record<number, boolean> {
    const visibilityMap: Record<number, boolean> = {};

    for (const field of fields) {
        // Each field is evaluated independently with its own rules
        visibilityMap[field.id] = evaluateFieldVisibility(field, allFieldValues, context);
        
        // Debug logging (can be removed in production)
        // Check for development mode
        const isDevelopment = typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development';
        if (isDevelopment && field.show_rule_set) {
            const groups = field.show_rule_set.groups && field.show_rule_set.groups.length > 0 
                ? field.show_rule_set.groups 
                : (field.show_rule_set.group ? [field.show_rule_set.group] : []);
            
            console.log(`Field ${field.id} (${field.label}):`, {
                visible: visibilityMap[field.id],
                hasRules: !!field.show_rule_set,
                ruleSetEnabled: field.show_rule_set.enabled,
                groups: groups.map(g => ({
                    enabled: g.enabled,
                    action: g.visibility_action || 'show',
                    criteriaCount: g.criteria?.length || 0
                }))
            });
        }
    }

    return visibilityMap;
}

