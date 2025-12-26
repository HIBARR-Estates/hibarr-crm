<?php

namespace App\Services;

use App\Models\CustomField;
use App\Models\CustomFieldCondition;
use App\Models\CustomFieldVisibility;
use Illuminate\Support\Facades\DB;

class CustomFieldRuleService
{
    /**
     * Save conditions and visibility rules for a custom field.
     *
     * @param CustomField $customField
     * @param array $conditions Array of conditions: [['target_field_id' => 1, 'operator' => '==', 'value' => 'val']]
     * @param string|null $logicString Logic string: "(1 && 2) || 3"
     * @return void
     */
    public function saveRules(CustomField $customField, array $conditions, ?string $logicString)
    {
        DB::transaction(function () use ($customField, $conditions, $logicString) {
            // 1. Delete existing conditions and visibility
            $customField->conditions()->delete();
            $customField->visibility()->delete();

            if (empty($conditions)) {
                return;
            }

            // 2. Save new conditions
            $conditionMap = []; // Map temporary index (from UI) to actual DB ID if needed, 
                                // but here we assume the logic string uses 1-based index of the conditions array.
            
            foreach ($conditions as $index => $condition) {
                $createdCondition = $customField->conditions()->create([
                    'target_field_id' => $condition['target_field_id'],
                    'operator' => $condition['operator'],
                    'value' => $condition['value'] ?? null,
                ]);
                // We might need to map the index used in logic string to the actual condition, 
                // but usually the logic string refers to "Condition 1", "Condition 2" which corresponds to the order.
            }

            // 3. Save visibility logic
            if ($logicString) {
                $customField->visibility()->create([
                    'logic_string' => $logicString
                ]);
            }
        });
    }

    /**
     * Validate the logic string against the number of conditions.
     *
     * @param string $logicString
     * @param int $conditionCount
     * @return bool
     */
    public function validateLogicString(string $logicString, int $conditionCount): bool
    {
        // Simple validation: check if it contains only allowed characters (digits, (, ), &, |, space)
        if (!preg_match('/^[0-9\(\)\&\|\s]+$/', $logicString)) {
            return false;
        }

        // Check if all numbers in the string are within the range of condition count
        preg_match_all('/\d+/', $logicString, $matches);
        foreach ($matches[0] as $number) {
            if ($number < 1 || $number > $conditionCount) {
                return false;
            }
        }

        return true;
    }
}
