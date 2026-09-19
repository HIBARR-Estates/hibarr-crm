<?php

namespace App\Services;

use App\Models\DealAutomationCondition;
use App\Models\LeadAutomationCondition;
use Carbon\Carbon;
use Illuminate\Support\Str;

class ConditionEvaluatorService
{
    /**
     * Date/datetime shapes worth parsing for comparison — deliberately
     * narrow (anchored, not "contains digits somewhere") so an arbitrary
     * text/id field never gets misread as a date. Covers what a native
     * `<input type=date>` sends (ISO) and what Carbon::toDateTimeString()
     * produces, plus the common slashed/dotted and written-out forms.
     */
    private const DATE_PATTERNS = [
        '/^\d{4}-\d{1,2}-\d{1,2}([ T]\d{1,2}:\d{2}(:\d{2})?)?$/',
        '/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/',
        '/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/',
        '/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/',
    ];

    /**
     * @param  bool|null  $fieldChanged  Whether the condition's field changed
     *                                   during the event that triggered this
     *                                   evaluation — required for the
     *                                   'changed' operator, which a resolved
     *                                   value alone can't answer (this class
     *                                   has no model/history access). The
     *                                   caller resolves it via the subject's
     *                                   own Eloquent dirty-tracking before
     *                                   calling here; null (not evaluable —
     *                                   e.g. a custom field, or a freshly
     *                                   reloaded subject with no in-memory
     *                                   change history) is treated as false.
     */
    public function evaluate($resolvedValue, DealAutomationCondition|LeadAutomationCondition $condition, ?bool $fieldChanged = null): bool
    {
        $operator = $condition->operator;
        $conditionValue = $condition->value;

        // Handle 'exists' operator separately as it doesn't need a condition value
        if ($operator === 'exists') {
            return !empty($resolvedValue);
        }

        if ($operator === 'changed') {
            return (bool) $fieldChanged;
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
     * Normalize a value for comparison: numbers become numeric, a date/time
     * value (whether it arrives as a DateTimeInterface from the resolver, or
     * a string that unambiguously looks like a date) becomes a Unix
     * timestamp so two dates in different formats/types still compare
     * correctly — everything else (names, statuses, ids, free text) is left
     * exactly as resolved.
     *
     * @param  mixed  $value
     * @return mixed
     */
    protected function normalizeValue($value)
    {
        if (is_null($value)) {
            return null;
        }

        if ($value instanceof \DateTimeInterface) {
            return $value->getTimestamp();
        }

        if (is_numeric($value)) {
            return $value + 0; // Convert to int or float
        }

        if (is_string($value) && $this->looksLikeDate($value)) {
            try {
                return Carbon::parse($value)->getTimestamp();
            } catch (\Throwable $e) {
                // Didn't actually parse (e.g. "13/45/2026") — fall through
                // and compare it as a plain string instead of erroring.
                return $value;
            }
        }

        return $value;
    }

    /**
     * Whether $value's shape unambiguously looks like a date/datetime, not
     * whether it necessarily parses — Carbon::parse() still gets the final
     * say (and a try/catch) in normalizeValue(). Kept intentionally narrow:
     * matching on "contains 4 digits" would misfire on ids, phone numbers,
     * and reference codes.
     */
    protected function looksLikeDate(string $value): bool
    {
        $trimmed = trim($value);

        foreach (self::DATE_PATTERNS as $pattern) {
            if (preg_match($pattern, $trimmed) === 1) {
                return true;
            }
        }

        return false;
    }
}
