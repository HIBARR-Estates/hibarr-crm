<?php

namespace Tests\Unit;

use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Regression guard for the bug fixed in StoreTask/UpdateTask::rules(): appending a
 * closure to an already pipe-delimited rule STRING via `[$ruleString, $closure]`
 * makes Laravel treat the whole string as one rule name (crashes with
 * "Method Illuminate\Validation\Validator::validateNullable|dateFormat does not exist").
 * The fix explodes the string into separate array elements before appending the closure.
 */
class TaskDateBoundsRuleTest extends TestCase
{
    private const DATE_FORMAT = 'd-m-Y h:i A';

    public function test_date_bounds_rule_appended_via_exploded_array_does_not_throw(): void
    {
        $rules = ['start_date' => $this->buildRuleSet('nullable|date_format:"' . self::DATE_FORMAT . '"')];

        $validator = Validator::make(['start_date' => '27-07-2026 09:00 AM'], $rules);

        $this->assertFalse($validator->fails());
    }

    public function test_date_bounds_rule_flags_out_of_range_year(): void
    {
        $rules = ['start_date' => $this->buildRuleSet('nullable|date_format:"' . self::DATE_FORMAT . '"')];

        $validator = Validator::make(['start_date' => '27-07-1220 09:00 AM'], $rules);

        $this->assertTrue($validator->fails());
    }

    public function test_appending_closure_to_raw_rule_string_reproduces_the_original_bug(): void
    {
        $rules = ['start_date' => ['nullable|date_format:"' . self::DATE_FORMAT . '"', $this->dateBoundsClosure()]];

        $this->expectException(\BadMethodCallException::class);

        Validator::make(['start_date' => '27-07-2026 09:00 AM'], $rules)->fails();
    }

    private function buildRuleSet(string $pipeDelimitedRule): array
    {
        return array_merge(explode('|', $pipeDelimitedRule), [$this->dateBoundsClosure()]);
    }

    private function dateBoundsClosure(): \Closure
    {
        return function ($attribute, $value, $fail) {
            if (!is_string($value) || $value === '') {
                return;
            }
            $parsed = \DateTime::createFromFormat(self::DATE_FORMAT, $value);
            if ($parsed && ((int) $parsed->format('Y') < now()->year - 10 || (int) $parsed->format('Y') > now()->year + 10)) {
                $fail('out of range');
            }
        };
    }
}
