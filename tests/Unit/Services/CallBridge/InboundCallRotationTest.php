<?php

namespace Tests\Unit\Services\CallBridge;

use App\Services\CallBridge\InboundCallRotation;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class InboundCallRotationTest extends TestCase
{
    private const COMPANY = 1;

    private const CALL = 'sip-call-abc';

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_a_call_starts_with_the_first_user_for_a_full_slot(): void
    {
        $rotation = $this->resolve($this->users(10, 11, 12));

        $this->assertSame(0, $rotation['index']);
        $this->assertSame(20, $rotation['slot_remaining_seconds']);
        $this->assertSame([10, 11, 12], array_column($rotation['users'], 'id'));
    }

    public function test_every_agent_sees_the_same_position_whenever_they_ask(): void
    {
        $this->resolve($this->users(10, 11, 12));

        // A browser that only joins 25s into the call is told the second
        // agent is ringing, with 15s of that slot left.
        $this->age(25);
        $late = $this->resolve($this->users(10, 11, 12));

        $this->assertSame(1, $late['index']);
        $this->assertSame(15, $late['slot_remaining_seconds']);
    }

    public function test_a_pass_moves_on_at_once_and_gives_the_next_agent_a_full_slot(): void
    {
        $this->resolve($this->users(10, 11, 12));
        $this->age(5);

        $rotation = $this->resolve($this->users(10, 11, 12), passed: [10]);

        $this->assertSame(1, $rotation['index']);
        $this->assertSame(20, $rotation['slot_remaining_seconds']);
    }

    public function test_an_agent_who_passed_is_never_rung_again(): void
    {
        $this->resolve($this->users(10, 11, 12));

        $rotation = $this->resolve($this->users(10, 11, 12), passed: [10, 11]);

        $this->assertSame(2, $rotation['index']);
    }

    public function test_the_order_is_frozen_when_availability_changes_mid_call(): void
    {
        $this->resolve($this->users(10, 11, 12));
        $this->age(20);

        // Agent 10 pauses while agent 11 is ringing: positions must not
        // shift, or agent 12 would ring while 11 still has the call.
        $rotation = $this->resolve($this->users(11, 12));

        $this->assertSame([10, 11, 12], array_column($rotation['users'], 'id'));
        $this->assertSame(1, $rotation['index']);
    }

    public function test_an_agent_who_became_unavailable_is_skipped(): void
    {
        $this->resolve($this->users(10, 11, 12));
        $this->age(20);

        $rotation = $this->resolve($this->users(10, 12));

        $this->assertSame(2, $rotation['index']);
    }

    public function test_the_rotation_ends_after_the_last_agent(): void
    {
        $this->resolve($this->users(10, 11));
        $this->age(45);

        $rotation = $this->resolve($this->users(10, 11));

        $this->assertSame(2, $rotation['index']);
        $this->assertSame(15, $rotation['slot_remaining_seconds']);
    }

    public function test_calls_rotate_independently(): void
    {
        $this->resolve($this->users(10, 11));
        $this->age(25);

        $other = InboundCallRotation::resolve(self::COMPANY, 'another-call', $this->users(10, 11), [], 20);

        $this->assertSame(0, $other['index']);
    }

    /** @return array{users: array<int, array<string, mixed>>, index: int, slot_remaining_seconds: int} */
    private function resolve(array $users, array $passed = []): array
    {
        return InboundCallRotation::resolve(self::COMPANY, self::CALL, $users, $passed, 20);
    }

    /** Pretend the call has been ringing for `$seconds` longer. */
    private function age(int $seconds): void
    {
        $key = InboundCallRotation::cacheKey(self::COMPANY, self::CALL);
        $state = Cache::get($key);
        $state['slot_started_at'] -= $seconds;
        Cache::put($key, $state, InboundCallRotation::TTL_SECONDS);
    }

    /** @return array<int, array{id: int, name: string, role: string}> */
    private function users(int ...$ids): array
    {
        return array_map(fn (int $id): array => ['id' => $id, 'name' => "User {$id}", 'role' => 'pool'], $ids);
    }
}
