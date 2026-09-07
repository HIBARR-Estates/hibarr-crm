<?php

namespace Tests\Unit\Services;

use App\Models\DealAutomationCondition;
use App\Services\ConditionEvaluatorService;
use Carbon\Carbon;
use Tests\TestCase;

class ConditionEvaluatorServiceTest extends TestCase
{
    protected ConditionEvaluatorService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new ConditionEvaluatorService();
    }

    public function test_it_evaluates_equals_operator()
    {
        $condition = new DealAutomationCondition(['operator' => '=', 'value' => 'test']);
        $this->assertTrue($this->service->evaluate('test', $condition));
        $this->assertFalse($this->service->evaluate('other', $condition));

        $condition = new DealAutomationCondition(['operator' => '=', 'value' => 100]);
        $this->assertTrue($this->service->evaluate(100, $condition));
        $this->assertTrue($this->service->evaluate('100', $condition)); // Type juggling
        $this->assertFalse($this->service->evaluate(50, $condition));
    }

    public function test_it_evaluates_greater_than_operator()
    {
        $condition = new DealAutomationCondition(['operator' => '>', 'value' => 100]);
        $this->assertTrue($this->service->evaluate(150, $condition));
        $this->assertFalse($this->service->evaluate(100, $condition));
        $this->assertFalse($this->service->evaluate(50, $condition));
    }

    public function test_it_evaluates_less_than_operator()
    {
        $condition = new DealAutomationCondition(['operator' => '<', 'value' => 100]);
        $this->assertTrue($this->service->evaluate(50, $condition));
        $this->assertFalse($this->service->evaluate(100, $condition));
        $this->assertFalse($this->service->evaluate(150, $condition));
    }

    public function test_it_evaluates_contains_operator()
    {
        $condition = new DealAutomationCondition(['operator' => 'contains', 'value' => 'bar']);
        $this->assertTrue($this->service->evaluate('foobar', $condition));
        $this->assertFalse($this->service->evaluate('foo', $condition));
    }

    public function test_it_evaluates_exists_operator()
    {
        $condition = new DealAutomationCondition(['operator' => 'exists', 'value' => null]);
        $this->assertTrue($this->service->evaluate('something', $condition));
        $this->assertTrue($this->service->evaluate(123, $condition));
        $this->assertFalse($this->service->evaluate(null, $condition));
        $this->assertFalse($this->service->evaluate('', $condition));
    }

    public function test_it_handles_date_comparisons()
    {
        $condition = new DealAutomationCondition(['operator' => '>', 'value' => '2023-01-01']);
        $this->assertTrue($this->service->evaluate('2023-02-01', $condition));
        $this->assertFalse($this->service->evaluate('2022-12-31', $condition));
    }

    public function test_it_compares_dates_across_different_formats()
    {
        // A Carbon field value (as a resolver would return for a
        // date-cast column) against a condition value typed in a different
        // format — both normalize to a timestamp, so the comparison is
        // correct regardless of either side's original shape.
        $condition = new DealAutomationCondition(['operator' => '>', 'value' => '01/02/2023']); // 1 Feb 2023
        $this->assertTrue($this->service->evaluate(Carbon::parse('2023-03-15'), $condition));
        $this->assertFalse($this->service->evaluate(Carbon::parse('2023-01-15'), $condition));

        $equals = new DealAutomationCondition(['operator' => '=', 'value' => '2023-02-01']);
        $this->assertTrue($this->service->evaluate('01/02/2023', $equals));
    }

    public function test_it_does_not_misread_non_date_strings_as_dates()
    {
        // Contains a run of 4 digits but isn't a date shape — must still
        // compare as plain strings, not get coerced into a timestamp.
        $condition = new DealAutomationCondition(['operator' => 'contains', 'value' => '2024']);
        $this->assertTrue($this->service->evaluate('reference-2024-a', $condition));

        $equals = new DealAutomationCondition(['operator' => '=', 'value' => 'reference-2024-a']);
        $this->assertTrue($this->service->evaluate('reference-2024-a', $equals));
    }

    public function test_it_evaluates_changed_operator_from_caller_supplied_flag()
    {
        $condition = new DealAutomationCondition(['operator' => 'changed', 'value' => null]);

        $this->assertTrue($this->service->evaluate('anything', $condition, true));
        $this->assertFalse($this->service->evaluate('anything', $condition, false));
        // No fieldChanged context supplied (e.g. a non-native/custom field,
        // or a freshly reloaded subject) — treated as false, not a guess.
        $this->assertFalse($this->service->evaluate('anything', $condition));
    }
}
