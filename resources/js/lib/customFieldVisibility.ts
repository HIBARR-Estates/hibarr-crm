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
            // Handle arrays (for checkbox fields) - check if the value is in the array
            if (Array.isArray(fieldValue)) {
                // Check if reference_value is in the array (case-insensitive)
                result = fieldValue.some(val => 
                    String(val).toLowerCase() === String(reference_value).toLowerCase()
                );
            } else {
                result = String(fieldValue) === String(reference_value);
            }
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
    
    // Ensure groups_operator has a default value if not set
    if (!ruleSet.groups_operator || (ruleSet.groups_operator !== 'AND' && ruleSet.groups_operator !== 'OR')) {
        ruleSet.groups_operator = 'AND';
    }

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
            const fieldKey = `field_${criterion.reference_field_id}`;
            const fieldValue = allFieldValues[fieldKey];
            const result = evaluateCriterion(criterion, fieldValue);
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
    // Get groups_operator from ruleSet, defaulting to 'AND' if not set
    const groupsOperator = (ruleSet.groups_operator && (ruleSet.groups_operator === 'OR' || ruleSet.groups_operator === 'AND')) 
        ? ruleSet.groups_operator 
        : 'AND';
    
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
    allFieldValues: Record<string, any>
): Record<number, boolean> {
    const visibilityMap: Record<number, boolean> = {};

    for (const field of fields) {
        // Each field is evaluated independently with its own rules
        visibilityMap[field.id] = evaluateFieldVisibility(field, allFieldValues);
        
        // Debug logging (can be removed in production)
        if (process.env.NODE_ENV === 'development' && field.show_rule_set) {
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

