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
        // Note: The current implementation treats dates as strings if passed as strings.
        // Ideally we should compare timestamps if we know they are dates.
        // But for now, let's test string comparison which works for ISO dates.
        
        $condition = new DealAutomationCondition(['operator' => '>', 'value' => '2023-01-01']);
        $this->assertTrue($this->service->evaluate('2023-02-01', $condition));
        $this->assertFalse($this->service->evaluate('2022-12-31', $condition));
    }
}
