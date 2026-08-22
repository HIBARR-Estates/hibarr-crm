<?php

namespace Tests\Unit\Services;

use App\Models\DealAutomation;
use App\Services\ConditionEvaluatorService;
use App\Services\DealAutomationService;
use App\Services\FieldResolverService;
use Mockery;
use Tests\TestCase;

class DealAutomationWaitTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    protected function service(): DealAutomationService
    {
        return new DealAutomationService(
            Mockery::mock(FieldResolverService::class),
            Mockery::mock(ConditionEvaluatorService::class),
        );
    }

    public function test_no_wait_configured_means_zero_seconds()
    {
        $automation = new DealAutomation;

        $this->assertSame(0, $this->service()->automationWaitSeconds($automation));
    }

    public function test_zero_or_negative_wait_means_run_immediately()
    {
        $automation = new DealAutomation(['wait_duration_value' => 0, 'wait_duration_unit' => 'days']);

        $this->assertSame(0, $this->service()->automationWaitSeconds($automation));
    }

    public function test_wait_seconds_resolve_each_unit()
    {
        $service = $this->service();

        $this->assertSame(300, $service->automationWaitSeconds(new DealAutomation(['wait_duration_value' => 5, 'wait_duration_unit' => 'minutes'])));
        $this->assertSame(7200, $service->automationWaitSeconds(new DealAutomation(['wait_duration_value' => 2, 'wait_duration_unit' => 'hours'])));
        $this->assertSame(86400, $service->automationWaitSeconds(new DealAutomation(['wait_duration_value' => 1, 'wait_duration_unit' => 'days'])));
    }

    public function test_missing_unit_falls_back_to_days()
    {
        $automation = new DealAutomation(['wait_duration_value' => 3]);

        $this->assertSame(3 * 86400, $this->service()->automationWaitSeconds($automation));
    }
}
