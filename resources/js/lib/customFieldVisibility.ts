import { CustomField, ShowRuleSet, ShowCriterion } from '@/Types';

/**
 * Evaluate a single criterion
 */
function evaluateCriterion(
    criterion: ShowCriterion,
    fieldValue: any
): boolean {
    const { operator, reference_value, negate } = criterion;
    let result = false;

    switch (operator) {
        case 'equals':
            result = String(fieldValue) === String(reference_value);
            break;

        case 'exists':
            // Handle arrays (for checkbox fields) - check if array has at least one element
            if (Array.isArray(fieldValue)) {
                result = fieldValue.length > 0;
            } else {
                result = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
            }
            break;

        case 'boolean':
            result = Boolean(fieldValue);
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
                result = Array.isArray(values) && values.includes(fieldValue);
            } catch {
                result = false;
            }
            break;

        case 'not_in':
            try {
                const values = JSON.parse(reference_value);
                result = Array.isArray(values) && !values.includes(fieldValue);
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
    allFieldValues: Record<string, any>
): boolean {
    const ruleSet = field.show_rule_set;

    // If no rule set, field is visible by default
    if (!ruleSet) {
        return true;
    }

    // If rule set is disabled, use default visibility
    if (!ruleSet.enabled) {
        return ruleSet.default_visibility;
    }

    // If no group or criteria, use default visibility
    if (!ruleSet.group || !ruleSet.group.criteria || ruleSet.group.criteria.length === 0) {
        return ruleSet.default_visibility;
    }

    const group = ruleSet.group;
    if (!group || !group.criteria) {
        return ruleSet.default_visibility;
    }

    const criteriaResults: boolean[] = [];

    // Evaluate each criterion
    for (const criterion of group.criteria) {
        const fieldKey = `field_${criterion.reference_field_id}`;
        const fieldValue = allFieldValues[fieldKey];
        const result = evaluateCriterion(criterion, fieldValue);
        criteriaResults.push(result);
    }

    // Combine criteria based on group operator
    let groupResult: boolean;
    if (group.group_operator === 'OR') {
        // At least one criterion must pass
        groupResult = criteriaResults.length > 0 && criteriaResults.some(r => r === true);
    } else {
        // All criteria must pass (AND logic)
        groupResult = criteriaResults.length > 0 && criteriaResults.every(r => r === true);
    }

    // Check for exclusion conditions: if "Residential" AND "Immigration/Exit Plan" are both selected, hide the field
    const exclusionResult = checkExclusionConditions(allFieldValues);
    if (exclusionResult === false) {
        return false; // Force hide if exclusion condition is met
    }

    return groupResult;
}

/**
 * Check for exclusion conditions that force a field to be hidden
 * Returns false if exclusion condition is met (field should be hidden)
 * Returns true if no exclusion or exclusion not met (normal evaluation continues)
 */
function checkExclusionConditions(allFieldValues: Record<string, any>): boolean | null {
    // Check if "Residential" and "Immigration/Exit Plan" are both selected
    // Look through all field values for checkbox arrays containing these values
    let hasResidential = false;
    let hasImmigrationExitPlan = false;

    for (const fieldKey in allFieldValues) {
        const fieldValue = allFieldValues[fieldKey];
        
        // Handle checkbox arrays
        if (Array.isArray(fieldValue)) {
            // Check if array contains "Residential" (case-insensitive)
            for (const value of fieldValue) {
                const valueStr = String(value).toLowerCase().trim();
                if (valueStr.includes('residential')) {
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
            if (valueStr.includes('residential')) {
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
    }

    // If both are selected, return false to force hide
    if (hasResidential && hasImmigrationExitPlan) {
        return false;
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
    allFieldValues: Record<string, any>
): Record<number, boolean> {
    const visibilityMap: Record<number, boolean> = {};

    for (const field of fields) {
        visibilityMap[field.id] = evaluateFieldVisibility(field, allFieldValues);
    }

    return visibilityMap;
}

