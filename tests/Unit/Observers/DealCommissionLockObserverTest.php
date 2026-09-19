<?php

namespace Tests\Unit\Observers;

use App\Models\Deal;
use App\Observers\DealObserver;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\DealTaskService;
use Mockery;
use Tests\TestCase;

class DealCommissionLockObserverTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_updating_reverts_agent_and_value_but_keeps_name(): void
    {
        $deal = new Deal([
            'commission_locked' => true,
            'agent_id' => 1,
            'name' => 'Old name',
            'manual_value' => 100,
        ]);
        $deal->syncOriginal();

        $deal->agent_id = 2;
        $deal->name = 'New name';
        $deal->manual_value = 999;

        $this->observer()->updating($deal);

        $this->assertSame(1, (int) $deal->agent_id);
        $this->assertSame(100.0, (float) $deal->manual_value);
        $this->assertSame('New name', $deal->name);
    }

    public function test_updating_allows_clearing_the_commission_lock(): void
    {
        $deal = new Deal([
            'commission_locked' => true,
            'agent_id' => 1,
            'manual_value' => 100,
        ]);
        $deal->syncOriginal();

        $deal->commission_locked = false;
        $deal->agent_id = 2;

        $this->observer()->updating($deal);

        $this->assertFalse((bool) $deal->commission_locked);
        $this->assertSame(2, (int) $deal->agent_id);
    }

    private function observer(): DealObserver
    {
        return new DealObserver(
            Mockery::mock(DealAutomationService::class),
            Mockery::mock(DealNotificationService::class),
            Mockery::mock(DealTaskService::class),
        );
    }
}
