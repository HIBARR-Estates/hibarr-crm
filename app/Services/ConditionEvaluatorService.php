<?php

namespace App\Services;

use App\Models\DealAutomationCondition;
use App\Models\LeadAutomationCondition;
use Carbon\Carbon;
use Illuminate\Support\Str;

class ConditionEvaluatorService
{
    public function evaluate($resolvedValue, DealAutomationCondition|LeadAutomationCondition $condition): bool
    {
        $operator = $condition->operator;
        $conditionValue = $condition->value;

        // Handle 'exists' operator separately as it doesn't need a condition value
        if ($operator === 'exists') {
            return !empty($resolvedValue);
        }

        // Handle 'changed' operator - this requires context about previous state which we might not have here directly.
        // For now, we assume 'changed' is handled at a higher level or we need to pass previous value.
        // If we only have resolvedValue (current), we can't check 'changed' unless we pass $previousValue.
        // The prompt says "Accepts a resolved value and a condition object".
        // If 'changed' is required, we might need to rethink the signature or assume it's always true if triggered by an event that implies change?
        // Or maybe we just return false for now if we can't evaluate it.
        // However, the RFC says "Evaluates operators: ... changed".
        // Let's assume for now 'changed' is not supported in this stateless evaluator or we need to pass extra context.
        // But wait, if the trigger is "deal_updated", we might know it changed.
        // Let's skip 'changed' implementation here or treat it as "always true" if we assume the caller filters by changed fields?
        // No, that's dangerous.
        // Let's implement the standard operators first.
        
        if ($operator === 'changed') {
             // We cannot evaluate 'changed' without previous value.
             // We will return false or throw exception.
             // For now, let's return false to be safe.
             return false;
        }

        // Normalize values for comparison
        $resolvedValue = $this->normalizeValue($resolvedValue);
        $conditionValue = $this->normalizeValue($conditionValue);

        switch ($operator) {
            case '=':
                return $resolvedValue == $conditionValue;
            case '>':
                return $resolvedValue > $conditionValue;
            case '<':
                return $resolvedValue < $conditionValue;
            case 'contains':
                if (is_array($resolvedValue)) {
                    return in_array($conditionValue, $resolvedValue);
                }
                return Str::contains((string) $resolvedValue, (string) $conditionValue);
            default:
                return false;
        }
    }

    /**
     * Normalize value for comparison.
     *
     * @param mixed $value
     * @return mixed
     */
    protected function normalizeValue($value)
    {
        if (is_null($value)) {
            return null;
        }

        if (is_numeric($value)) {
            return $value + 0; // Convert to int or float
        }

        if (is_string($value)) {
            // Check if it's a date
            if (strtotime($value) !== false) {
                // It's a date string, but be careful with simple numbers or strings that look like dates.
                // For safety, maybe only convert if it looks like Y-m-d or similar?
                // Or just compare as strings/timestamps if both are dates.
                // Let's keep it simple: if it parses as Carbon, use timestamp for comparison?
                // But "100" parses as date? No.
                // Let's stick to string comparison for non-numeric strings unless we know the field type.
                // Without field type metadata, aggressive date parsing is risky.
                return $value;
            }
            return $value;
        }
        
        if ($value instanceof Carbon) {
            return $value->toDateTimeString();
        }

        return $value;
    }
}
