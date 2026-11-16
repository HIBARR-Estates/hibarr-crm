<?php

namespace Tests\Unit\Services\CallBridge;

use App\Models\SoftphoneDevice;
use App\Services\CallBridge\LineConcurrencyManager;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class LineConcurrencyManagerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_a_line_takes_calls_up_to_its_limit(): void
    {
        $line = $this->line(max: 2);

        $this->assertTrue(LineConcurrencyManager::reserve($line, 10));
        $this->assertTrue(LineConcurrencyManager::reserve($line, 11));
        $this->assertFalse(LineConcurrencyManager::reserve($line, 12));

        $this->assertSame(2, LineConcurrencyManager::activeCallsCount(42));
        $this->assertFalse(LineConcurrencyManager::hasCapacity($line));
    }

    public function test_releasing_a_slot_frees_the_line(): void
    {
        $line = $this->line(max: 1);

        LineConcurrencyManager::reserve($line, 10);
        $this->assertFalse(LineConcurrencyManager::reserve($line, 11));

        LineConcurrencyManager::release(42, 10);

        $this->assertTrue(LineConcurrencyManager::reserve($line, 11));
    }

    public function test_an_agent_holds_one_slot_however_often_they_reserve(): void
    {
        $line = $this->line(max: 2);

        // A lost "call ended" must not leave the agent holding two slots.
        LineConcurrencyManager::reserve($line, 10);
        LineConcurrencyManager::reserve($line, 10);

        $this->assertSame(1, LineConcurrencyManager::activeCallsCount(42));
    }

    public function test_only_the_holder_frees_a_slot(): void
    {
        $line = $this->line(max: 2);
        LineConcurrencyManager::reserve($line, 10);

        // Another agent's missed/declined leg of the same call ends nothing.
        LineConcurrencyManager::release(42, 11);

        $this->assertSame(1, LineConcurrencyManager::activeCallsCount(42));
    }

    public function test_an_answered_call_is_recorded_even_on_a_full_line(): void
    {
        $line = $this->line(max: 1);
        LineConcurrencyManager::reserve($line, 10);

        $this->assertTrue(LineConcurrencyManager::reserve($line, 11, force: true));
        $this->assertSame(2, LineConcurrencyManager::activeCallsCount(42));
    }

    public function test_a_disabled_line_has_no_capacity(): void
    {
        $line = $this->line(max: 2, active: false);

        $this->assertFalse(LineConcurrencyManager::hasCapacity($line));
        $this->assertFalse(LineConcurrencyManager::reserve($line, 10));
    }

    public function test_a_line_without_a_limit_uses_its_platform_default(): void
    {
        $line = $this->line(max: null);

        $this->assertSame(2, LineConcurrencyManager::maxConcurrentCalls($line));
    }

    public function test_orphaned_slots_are_dropped(): void
    {
        Cache::put(LineConcurrencyManager::cacheKey(42), [
            10 => now()->timestamp - (LineConcurrencyManager::STALE_CALL_SECONDS + 60),
            11 => now()->timestamp - 600,
        ], 86400);

        $this->assertSame(1, LineConcurrencyManager::activeCallsCount(42));
    }

    public function test_capacity_can_ignore_the_asking_agents_own_slot(): void
    {
        $line = $this->line(max: 1);
        LineConcurrencyManager::reserve($line, 10);

        $this->assertFalse(LineConcurrencyManager::capacityInfo($line)['available']);
        $this->assertTrue(LineConcurrencyManager::capacityInfo($line, 10)['available']);
    }

    public function test_clearing_a_line_forgets_its_calls(): void
    {
        LineConcurrencyManager::reserve($this->line(max: 2), 10);

        LineConcurrencyManager::clearDevice(42);

        $this->assertSame(0, LineConcurrencyManager::activeCallsCount(42));
    }

    private function line(?int $max, bool $active = true): SoftphoneDevice
    {
        $line = new SoftphoneDevice;
        $line->id = 42;
        $line->provider = 'sipgate';
        $line->is_active = $active;
        $line->max_concurrent_calls = $max;

        return $line;
    }
}
