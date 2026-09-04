<?php

namespace Tests\Unit;

use App\Models\Deal;
use Tests\TestCase;

/**
 * Deal::touchesValueFields()/isCommissionLocked() are pure logic — no DB
 * needed — so tested directly rather than through the full app harness.
 *
 * This is the single list every value-affecting entry point (DealController,
 * DealGatheringController, DealPropertyController, the gRPC deal service)
 * checks before allowing a write once a deal is commission-locked. A field
 * missing from VALUE_AFFECTING_KEYS is a silent hole in that protection.
 */
class DealCommissionLockTest extends TestCase
{
    public function test_is_commission_locked_reflects_the_column(): void
    {
        $deal = new Deal;

        $deal->commission_locked = false;
        $this->assertFalse($deal->isCommissionLocked());

        $deal->commission_locked = true;
        $this->assertTrue($deal->isCommissionLocked());
    }

    /**
     * @dataProvider valueAffectingKeyProvider
     */
    public function test_touches_value_fields_detects_each_known_value_affecting_key(string $key): void
    {
        $this->assertTrue(Deal::touchesValueFields([$key => 'anything']));
    }

    public static function valueAffectingKeyProvider(): array
    {
        return array_map(fn (string $key) => [$key], Deal::VALUE_AFFECTING_KEYS);
    }

    public function test_touches_value_fields_is_false_for_unrelated_fields(): void
    {
        $this->assertFalse(Deal::touchesValueFields([
            'pipeline_stage_id' => 5,
            'agent_id' => 7,
            'note' => 'called the client',
        ]));
    }

    public function test_touches_value_fields_is_false_for_empty_payload(): void
    {
        $this->assertFalse(Deal::touchesValueFields([]));
    }

    public function test_touches_value_fields_true_when_mixed_with_unrelated_fields(): void
    {
        $this->assertTrue(Deal::touchesValueFields([
            'pipeline_stage_id' => 5,
            'manual_value' => 1000,
        ]));
    }
}
