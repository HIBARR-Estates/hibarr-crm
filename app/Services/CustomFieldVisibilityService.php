<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\ShowRuleSet;
use App\Models\ShowCriterion;

class CustomFieldVisibilityService
{
    /**
     * Evaluate visibility for a single field
     *
     * @param int $fieldId
     * @param array $currentValues Array of field values: ['field_47' => 'Yes', 'field_48' => 'No']
     * @return bool
     */
    public function evaluate(int $fieldId, array $currentValues): bool
    {
        // Load rule set with only enabled groups to improve performance
        $field = CustomField::with([
            'showRuleSet' => function($query) {
                $query->with([
                    'groups' => function($q) {
                        // Only load enabled groups to reduce data
                        $q->where('enabled', true)->with('criteria.referenceField');
                    }
                ]);
            }
        ])->find($fieldId);
        
        if (!$field || !$field->showRuleSet) {
            return true; // Default: visible if no rules
        }

        $ruleSet = $field->showRuleSet;

        // If rule set is disabled, use default visibility
        if (!$ruleSet->enabled) {
            return $ruleSet->default_visibility;
        }

        // Groups are already loaded via eager loading (only enabled ones)
        $groups = $ruleSet->groups;

        // If no groups or all groups are empty, use default visibility
        if ($groups->isEmpty() || $groups->every(fn($g) => $g->criteria->isEmpty())) {
            return $ruleSet->default_visibility;
        }

        $showGroupResults = [];
        $hideGroupResults = [];

        // Evaluate each group
        foreach ($groups as $group) {
            // Skip disabled groups (default to enabled if not set for backward compatibility)
            if (isset($group->enabled) && $group->enabled === false) {
                continue;
            }
            
            // If enabled is not set, treat as enabled (backward compatibility)
            // This handles old groups that don't have the enabled field yet
            
            if ($group->criteria->isEmpty()) {
                continue; // Skip empty groups
            }

            $criteriaResults = [];

            // Evaluate each criterion in the group
            foreach ($group->criteria as $criterion) {
                $referenceValue = $currentValues['field_' . $criterion->reference_field_id] ?? null;
                $result = $this->evaluateCriterion($criterion, $referenceValue);
                
                // Apply negation if needed
                $criteriaResults[] = $criterion->negate ? !$result : $result;
            }

            // Combine criteria within group based on group_operator
            if ($group->group_operator === 'OR') {
                // At least one criterion must pass (OR logic)
                // If any criterion is true, the group passes
                $groupResult = in_array(true, $criteriaResults, true);
            } else {
                // All criteria must pass (AND logic)
                $groupResult = !empty($criteriaResults) && !in_array(false, $criteriaResults, true);
            }

            // Separate groups by their visibility action
            $visibilityAction = $group->visibility_action ?? 'show'; // Default to 'show' for backward compatibility
            if ($visibilityAction === 'hide') {
                $hideGroupResults[] = $groupResult;
            } else {
                $showGroupResults[] = $groupResult;
            }
        }

        // Hide groups take absolute precedence - if ANY hide group matches, field is hidden
        // This is independent of the groups_operator - hide groups always work with OR logic
        // (if one group says hide, the field is hidden, regardless of other groups)
        if (!empty($hideGroupResults) && in_array(true, $hideGroupResults, true)) {
            return false; // Field is hidden if any hide group matches
        }

        // Otherwise, evaluate show groups
        // Get groups_operator from ruleSet, defaulting to 'AND' if not set
        $groupsOperator = $ruleSet->groups_operator ?? 'AND';
        
        if (empty($showGroupResults)) {
            // No show groups, use default visibility
            $finalResult = $ruleSet->default_visibility;
        } else if ($groupsOperator === 'OR') {
            // At least one show group must pass
            $finalResult = in_array(true, $showGroupResults, true);
        } else {
            // All show groups must pass (AND logic)
            $finalResult = !in_array(false, $showGroupResults, true);
        }

        // Check for exclusion conditions: if "Residential" AND "Immigration/Exit Plan" are both selected, hide the field
        $exclusionResult = $this->checkExclusionConditions($currentValues);
        if ($exclusionResult === false) {
            return false; // Force hide if exclusion condition is met
        }

        return $finalResult;
    }

    /**
     * Evaluate a single criterion
     *
     * @param ShowCriterion $criterion
     * @param mixed $fieldValue
     * @return bool
     */
    protected function evaluateCriterion($criterion, $fieldValue): bool
    {
        $operator = $criterion->operator;
        $referenceValue = $criterion->reference_value;

        switch ($operator) {
            case 'equals':
                // Handle arrays (for checkbox fields) - check if the value is in the array
                if (is_array($fieldValue)) {
                    // Check if referenceValue is in the array (case-insensitive)
                    foreach ($fieldValue as $val) {
                        if (strtolower(trim((string)$val)) === strtolower(trim((string)$referenceValue))) {
                            return true;
                        }
                    }
                    return false;
                }
                return (string)$fieldValue === (string)$referenceValue;

            case 'exists':
                // Handle arrays (for checkbox fields) - check if array has at least one element
                if (is_array($fieldValue)) {
                    return count($fieldValue) > 0;
                }
                return !empty($fieldValue);

            case 'boolean':
                return filter_var($fieldValue, FILTER_VALIDATE_BOOLEAN);

            case '>':
                return (float)$fieldValue > (float)$referenceValue;

            case '<':
                return (float)$fieldValue < (float)$referenceValue;

            case '>=':
                return (float)$fieldValue >= (float)$referenceValue;

            case '<=':
                return (float)$fieldValue <= (float)$referenceValue;

            case 'in':
                $values = json_decode($referenceValue, true) ?: [];
                return in_array($fieldValue, $values);

            case 'not_in':
                $values = json_decode($referenceValue, true) ?: [];
                return !in_array($fieldValue, $values);

            default:
                return false;
        }
    }

    /**
     * Check for exclusion conditions that force a field to be hidden
     * Returns false if exclusion condition is met (field should be hidden)
     * Returns true if no exclusion or exclusion not met (normal evaluation continues)
     *
     * @param array $currentValues
     * @return bool|null
     */
    protected function checkExclusionConditions(array $currentValues): ?bool
    {
        // Check if "Residential" and "Immigration/Exit Plan" are both selected
        // IMPORTANT: Only apply exclusion if both values are in the SAME field
        // This prevents hiding fields when "Residential" is in "Purpose of Investment" 
        // and "Immigration/Exit Plan" is in a different field like "Residential" section
        
        foreach ($currentValues as $fieldKey => $fieldValue) {
            $hasResidential = false;
            $hasImmigrationExitPlan = false;
            
            // Handle checkbox arrays
            if (is_array($fieldValue)) {
                // Check if THIS SPECIFIC FIELD contains both values
                foreach ($fieldValue as $value) {
                    $valueStr = is_string($value) ? strtolower(trim($value)) : '';
                    if (strpos($valueStr, 'residential') !== false && strpos($valueStr, 'immigration') === false) {
                        // Check it's just "Residential", not "Residential" section options
                        $hasResidential = true;
                    }
                    if (strpos($valueStr, 'immigration') !== false && strpos($valueStr, 'exit') !== false) {
                        $hasImmigrationExitPlan = true;
                    }
                    // Also check for "Immigration/Exit Plan" as exact match
                    if (strpos($valueStr, 'immigration/exit plan') !== false || 
                        strpos($valueStr, 'immigration / exit plan') !== false) {
                        $hasImmigrationExitPlan = true;
                    }
                }
            } else {
                // Handle string values (comma-separated checkbox values)
                $valueStr = is_string($fieldValue) ? strtolower(trim($fieldValue)) : '';
                if (strpos($valueStr, 'residential') !== false && strpos($valueStr, 'immigration') === false) {
                    $hasResidential = true;
                }
                if (strpos($valueStr, 'immigration') !== false && strpos($valueStr, 'exit') !== false) {
                    $hasImmigrationExitPlan = true;
                }
                if (strpos($valueStr, 'immigration/exit plan') !== false || 
                    strpos($valueStr, 'immigration / exit plan') !== false) {
                    $hasImmigrationExitPlan = true;
                }
            }
            
            // Only apply exclusion if BOTH values are in the SAME field
            if ($hasResidential && $hasImmigrationExitPlan) {
                return false; // Force hide if both are in the same field
            }
        }

        // No exclusion condition met, continue with normal evaluation
        return true;
    }

    /**
     * Evaluate visibility for multiple fields at once
     *
     * @param array $fieldIds
     * @param array $currentValues
     * @return array ['field_47' => true, 'field_48' => false, ...]
     */
    public function evaluateMultiple(array $fieldIds, array $currentValues): array
    {
        $results = [];
        
        foreach ($fieldIds as $fieldId) {
            $results['field_' . $fieldId] = $this->evaluate($fieldId, $currentValues);
        }
        
        return $results;
    }
}


