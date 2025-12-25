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
        $field = CustomField::with(['showRuleSet.group.criteria.referenceField'])->find($fieldId);
        
        if (!$field || !$field->showRuleSet) {
            return true; // Default: visible if no rules
        }

        $ruleSet = $field->showRuleSet;

        // If rule set is disabled, use default visibility
        if (!$ruleSet->enabled) {
            return $ruleSet->default_visibility;
        }

        // If no groups, use default visibility
        if (!$ruleSet->group || $ruleSet->group->criteria->isEmpty()) {
            return $ruleSet->default_visibility;
        }

        $group = $ruleSet->group;
        $criteriaResults = [];

        // Evaluate each criterion in the group
        foreach ($group->criteria as $criterion) {
            $referenceValue = $currentValues['field_' . $criterion->reference_field_id] ?? null;
            $result = $this->evaluateCriterion($criterion, $referenceValue);
            
            // Apply negation if needed
            $criteriaResults[] = $criterion->negate ? !$result : $result;
        }

        // Combine criteria based on group operator
        if ($group->group_operator === 'OR') {
            // At least one criterion must pass
            $groupResult = !empty($criteriaResults) && in_array(true, $criteriaResults, true);
        } else {
            // All criteria must pass (AND logic)
            $groupResult = !empty($criteriaResults) && !in_array(false, $criteriaResults, true);
        }

        // Check for exclusion conditions: if "Residential" AND "Immigration/Exit Plan" are both selected, hide the field
        $exclusionResult = $this->checkExclusionConditions($currentValues);
        if ($exclusionResult === false) {
            return false; // Force hide if exclusion condition is met
        }

        return $groupResult;
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
        // Look through all field values for checkbox arrays containing these values
        $hasResidential = false;
        $hasImmigrationExitPlan = false;

        foreach ($currentValues as $fieldKey => $fieldValue) {
            // Handle checkbox arrays
            if (is_array($fieldValue)) {
                // Check if array contains "Residential" (case-insensitive)
                foreach ($fieldValue as $value) {
                    $valueStr = is_string($value) ? strtolower(trim($value)) : '';
                    if (strpos($valueStr, 'residential') !== false) {
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
                if (strpos($valueStr, 'residential') !== false) {
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
        }

        // If both are selected, return false to force hide
        if ($hasResidential && $hasImmigrationExitPlan) {
            return false;
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


