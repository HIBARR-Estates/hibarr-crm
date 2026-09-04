<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\ShowCriterion;

class CustomFieldVisibilityService
{
    /**
     * Evaluate visibility for a single field
     *
     * @param  array  $currentValues  Array of field values: ['field_47' => 'Yes', 'field_48' => 'No'], plus
     *                                reserved deal-context keys ('pipeline', 'pipeline_stage', 'package', 'record')
     * @param  array<int, array{id: int, priority: int}>  $stages  Pipeline stages (id + priority), used to
     *                                                             resolve ordering operators (>=, <=, ...) on a `pipeline_stage` criterion —
     *                                                             stage ids are arbitrary, only priority is orderable.
     */
    public function evaluate(int $fieldId, array $currentValues, array $stages = []): bool
    {
        // Load rule set with only enabled groups to improve performance
        $field = CustomField::with([
            'showRuleSet' => function ($query) {
                $query->with([
                    'groups' => function ($q) {
                        // Only load enabled groups to reduce data
                        $q->where('enabled', true)->with('criteria.referenceField');
                    },
                ]);
            },
        ])->find($fieldId);

        if (! $field || ! $field->showRuleSet) {
            return true; // Default: visible if no rules
        }

        $ruleSet = $field->showRuleSet;

        // If rule set is disabled, use default visibility
        if (! $ruleSet->enabled) {
            return $ruleSet->default_visibility;
        }

        // Groups are already loaded via eager loading (only enabled ones)
        $groups = $ruleSet->groups;

        // If no groups or all groups are empty, use default visibility
        if ($groups->isEmpty() || $groups->every(fn ($g) => $g->criteria->isEmpty())) {
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
                [$fieldValue, $referenceValue] = $this->resolveCriterionValues($criterion, $currentValues, $stages);
                $result = $this->evaluateCriterion($criterion, $fieldValue, $referenceValue);

                // Apply negation if needed
                $criteriaResults[] = $criterion->negate ? ! $result : $result;
            }

            // Combine criteria within group based on group_operator
            if ($group->group_operator === 'OR') {
                // At least one criterion must pass (OR logic)
                // If any criterion is true, the group passes
                $groupResult = in_array(true, $criteriaResults, true);
            } else {
                // All criteria must pass (AND logic)
                $groupResult = ! empty($criteriaResults) && ! in_array(false, $criteriaResults, true);
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
        if (! empty($hideGroupResults) && in_array(true, $hideGroupResults, true)) {
            return false; // Field is hidden if any hide group matches
        }

        // Otherwise, evaluate show groups
        // Get groups_operator from ruleSet, defaulting to 'AND' if not set
        $groupsOperator = $ruleSet->groups_operator ?? 'AND';

        if (empty($showGroupResults)) {
            // No show groups, use default visibility
            $finalResult = $ruleSet->default_visibility;
        } elseif ($groupsOperator === 'OR') {
            // At least one show group must pass
            $finalResult = in_array(true, $showGroupResults, true);
        } else {
            // All show groups must pass (AND logic)
            $finalResult = ! in_array(false, $showGroupResults, true);
        }

        // NOTE: Exclusion conditions have been removed to allow full configurability through visibility rules.
        // If you need hardcoded exclusion logic, you can re-enable checkExclusionConditions() here.
        // For now, all visibility is controlled through the configurable rule system above.

        return $finalResult;
    }

    /**
     * Resolve the field value and reference value a criterion compares,
     * reading from the source it declares. Mirrors
     * resources/js/lib/customFieldVisibility.ts::resolveCriterionValues —
     * keep the two in sync or a field will render client-side but fail
     * server-side validation (or vice versa).
     *
     * @param  array<int, array{id: int, priority: int}>  $stages
     * @return array{0: mixed, 1: string} [$fieldValue, $referenceValue]
     */
    protected function resolveCriterionValues(ShowCriterion $criterion, array $currentValues, array $stages = []): array
    {
        $source = $criterion->reference_source ?? 'custom_field';
        $referenceValue = $criterion->reference_value;

        switch ($source) {
            case 'pipeline':
                $fieldValue = $currentValues['pipeline'] ?? null;
                $referenceValue = $this->normalizeIdListJson($referenceValue);
                $fieldValue = $fieldValue === null ? $fieldValue : (string) $fieldValue;
                break;

            case 'pipeline_stage':
                $fieldValue = $currentValues['pipeline_stage'] ?? null;

                if (in_array($criterion->operator, ['>', '<', '>=', '<='], true)) {
                    $currentPriority = $this->resolveStagePriority($fieldValue, $stages);
                    $targetPriority = $this->resolveStagePriority($referenceValue, $stages);
                    $fieldValue = $currentPriority;
                    // Explicit null (not the raw unresolved stage id) when the target
                    // stage doesn't resolve, so evaluateCriterion()'s guard can tell
                    // "unresolved" apart from a real priority.
                    $referenceValue = $targetPriority !== null ? (string) $targetPriority : null;
                } else {
                    $referenceValue = $this->normalizeIdListJson($referenceValue);
                    $fieldValue = $fieldValue === null ? $fieldValue : (string) $fieldValue;
                }
                break;

            case 'deal_package':
                $fieldValue = $currentValues['package'] ?? null;
                $referenceValue = $this->normalizeIdListJson($referenceValue);
                $fieldValue = $fieldValue === null ? $fieldValue : (string) $fieldValue;
                break;

            case 'record':
                $fieldValue = $currentValues['record'] ?? null;
                $referenceValue = $this->normalizeIdListJson($referenceValue);
                $fieldValue = $fieldValue === null ? $fieldValue : (string) $fieldValue;
                break;

            case 'custom_field':
            default:
                $fieldValue = $currentValues['field_'.$criterion->reference_field_id] ?? null;
                break;
        }

        return [$fieldValue, $referenceValue];
    }

    /**
     * Mirrors resources/js/lib/customFieldVisibility.ts::normalizeIdListJson —
     * an id-list criterion's reference_value can hold numbers or strings
     * depending on which UI wrote it (the simplified pipeline picker
     * serializes real numbers, the generic rule builder's multi-selects
     * serialize strings), and evaluateCriterion()'s `in`/`not_in` compares
     * array membership with strict `in_array(..., true)`. Normalize every
     * element to a string here so a numeric id still matches a same-valued
     * string id. Leaves a bare scalar (the `equals` shape) untouched.
     */
    protected function normalizeIdListJson(?string $raw): ?string
    {
        if ($raw === null || $raw === '') {
            return $raw;
        }

        if (str_starts_with(trim($raw), '[')) {
            $parsed = json_decode($raw, true);
            if (is_array($parsed)) {
                return json_encode(array_map('strval', $parsed));
            }
        }

        return $raw;
    }

    /**
     * @param  array<int, array{id: int, priority: int}>  $stages
     */
    protected function resolveStagePriority($stageId, array $stages): ?int
    {
        if ($stageId === null || $stageId === '') {
            return null;
        }

        foreach ($stages as $stage) {
            if ((string) ($stage['id'] ?? null) === (string) $stageId) {
                return (int) $stage['priority'];
            }
        }

        return null;
    }

    /**
     * Evaluate a single criterion
     *
     * @param  ShowCriterion  $criterion
     * @param  mixed  $fieldValue
     * @param  string|null  $referenceValue  Overrides $criterion->reference_value (used for resolved stage priorities).
     */
    protected function evaluateCriterion($criterion, $fieldValue, $referenceValue = null): bool
    {
        $operator = $criterion->operator;

        // A pipeline_stage ordering criterion resolves both sides to a stage
        // priority before reaching here (see resolveCriterionValues()) — a
        // null on either side means the stage id didn't resolve (unknown
        // stage), not a priority of 0. Coercing null to (float) 0 below would
        // make an unresolved stage silently satisfy/fail the comparison
        // instead of simply not matching.
        if (
            ($criterion->reference_source ?? 'custom_field') === 'pipeline_stage'
            && in_array($operator, ['>', '<', '>=', '<='], true)
            && ($fieldValue === null || $referenceValue === null)
        ) {
            return false;
        }

        $referenceValue = $referenceValue ?? $criterion->reference_value;

        switch ($operator) {
            case 'equals':
                // Handle arrays (for checkbox fields) - check if the value is in the array
                if (is_array($fieldValue)) {
                    // Check if referenceValue is in the array (case-insensitive)
                    foreach ($fieldValue as $val) {
                        if (strtolower(trim((string) $val)) === strtolower(trim((string) $referenceValue))) {
                            return true;
                        }
                    }

                    return false;
                }

                // Trim both values before comparison to match JavaScript behavior
                return trim((string) $fieldValue) === trim((string) $referenceValue);

            case 'exists':
                // Handle arrays (for checkbox fields) - check if array has at least one element
                if (is_array($fieldValue)) {
                    return count($fieldValue) > 0;
                }

                // Check if value exists: not null, not empty string
                // This matches JavaScript behavior: fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
                // Note: 0, false, and "0" are considered as existing values (user provided them)
                // In PHP, we check for null and empty string (which covers undefined-like behavior)
                return $fieldValue !== null && $fieldValue !== '';

            case 'boolean':
                return filter_var($fieldValue, FILTER_VALIDATE_BOOLEAN);

            case '>':
                return (float) $fieldValue > (float) $referenceValue;

            case '<':
                return (float) $fieldValue < (float) $referenceValue;

            case '>=':
                return (float) $fieldValue >= (float) $referenceValue;

            case '<=':
                return (float) $fieldValue <= (float) $referenceValue;

            case 'in':
                $values = json_decode($referenceValue, true) ?: [];

                // Handle empty/null values array
                if (empty($values)) {
                    return false;
                }

                // Handle arrays (for checkbox fields) - check if any element exists in $values
                if (is_array($fieldValue)) {
                    foreach ($fieldValue as $val) {
                        if (in_array($val, $values, true)) {
                            return true; // At least one element exists in $values
                        }
                    }

                    return false; // None of the elements exist in $values
                }

                // Scalar value - use strict comparison to match JavaScript's Array.includes() behavior
                return in_array($fieldValue, $values, true);

            case 'not_in':
                $values = json_decode($referenceValue, true) ?: [];

                // Handle empty/null values array
                if (empty($values)) {
                    return true; // If no values to check against, field value is not in the list
                }

                // Handle arrays (for checkbox fields) - return true only if none of the elements exist
                if (is_array($fieldValue)) {
                    foreach ($fieldValue as $val) {
                        if (in_array($val, $values, true)) {
                            return false; // At least one element exists in $values, so not_in is false
                        }
                    }

                    return true; // None of the elements exist in $values, so not_in is true
                }

                // Scalar value - use strict comparison to match JavaScript's Array.includes() behavior
                return ! in_array($fieldValue, $values, true);

            default:
                return false;
        }
    }

    /**
     * Check for exclusion conditions that force a field to be hidden
     * Returns false if exclusion condition is met (field should be hidden)
     * Returns true if no exclusion or exclusion not met (normal evaluation continues)
     */
    protected function checkExclusionConditions(array $currentValues): ?bool
    {
        // Check if "Residential" and "Immigration/Exit Plan" are both selected
        // IMPORTANT: Only apply exclusion if both values are in the SAME field
        // This prevents hiding fields when "Residential" is in "Purpose of Investment"
        // and "Immigration/Exit Plan" is in a different field like "Residential" section

        foreach ($currentValues as $fieldValue) {
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
     * @return array ['field_47' => true, 'field_48' => false, ...]
     */
    public function evaluateMultiple(array $fieldIds, array $currentValues, array $stages = []): array
    {
        $results = [];

        foreach ($fieldIds as $fieldId) {
            $results['field_'.$fieldId] = $this->evaluate($fieldId, $currentValues, $stages);
        }

        return $results;
    }
}
